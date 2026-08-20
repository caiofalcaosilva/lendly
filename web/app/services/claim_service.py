import uuid
from datetime import timedelta

from fastapi import BackgroundTasks, UploadFile

from app.models.claim import Claim
from app.models.payment import Payment
from app.models.user import User
from app.schemas.claim import (
    ClaimCreate,
    ClaimResponse,
    FundSummaryResponse,
)
from app.services import (
    activity_service,
    notification_service,
    payment_service,
    storage,
)
from app.services.loan_request_service._common import get_as_participant
from app.services.platform_settings_service import get_settings
from app.utils import errors
from app.utils.images import load_and_resize
from app.utils.money import to_cents_required, to_reais, to_reais_required
from app.utils.time import utcnow

# Claim statuses that count as "still active" for a given loan_request —
# a second claim can't be opened while one of these is outstanding.
_OPEN_CLAIM_STATUSES = ["pending", "approved", "overdue", "advanced_by_lendly", "paid"]
# A claim can still be marked "paid" (admin fallback, or automatically via
# the webhook) from any of these — "approved" covers the on-time happy
# path, the other two cover paying late or paying off the platform debt.
_PAYABLE_STATUSES = ["approved", "overdue", "advanced_by_lendly"]
# Statuses that actually keep User.is_restricted true — deliberately NOT
# "approved": a claim that hasn't gone overdue yet never restricted anyone
# in the first place, so it must not block clearing the flag for some
# OTHER claim that just got resolved (see _maybe_clear_restriction).
_RESTRICTING_STATUSES = ["overdue", "advanced_by_lendly"]
# advance_paid_by_lendly/cancel_claim each gate on their own explicit
# status(es) below, not a shared constant — "advanced_by_lendly" is
# intentionally NOT cancellable (see cancel_claim's docstring).


def _to_response(claim: Claim) -> ClaimResponse:
    return ClaimResponse(
        id=str(claim.id),
        loan_request_id=str(claim.loan_request.id),
        item_id=str(claim.item.id),
        item_title=claim.item.title,
        item_availability_type=claim.item.availability_type,
        owner_id=str(claim.owner.id),
        owner_name=claim.owner.name,
        requester_id=str(claim.requester.id),
        requester_name=claim.requester.name,
        description=claim.description,
        requested_amount=to_reais_required(claim.requested_amount_cents),
        declared_value=to_reais(claim.item.declared_value_cents) or 0.0,
        photos=claim.photos or [],
        status=claim.status,
        approved_amount=to_reais(claim.approved_amount_cents),
        rejection_reason=claim.rejection_reason,
        reviewed_by_name=claim.reviewed_by.name if claim.reviewed_by else None,
        reviewed_at=claim.reviewed_at,
        paid_at=claim.paid_at,
        advanced_at=claim.advanced_at,
        cancelled_at=claim.cancelled_at,
        cancellation_reason=claim.cancellation_reason,
        created_at=claim.created_at,
    )


def _record_claim_activity(claim: Claim, event: str, actor: User | None = None) -> None:
    activity_service.record(
        recipient=claim.owner,
        event=event,
        actor=actor,
        resource_type="claim",
        resource_id=str(claim.id),
        resource_title=claim.item.title,
    )


def _notify_owner(
    claim: Claim, title: str, body: str, background_tasks: BackgroundTasks
) -> None:
    """Reuses the existing 'request_status' in-app category — a claim is
    always tied to a LoanRequest, so it rides the same toggle/link as the
    rest of that request's lifecycle notifications instead of adding a new
    preference category for a single feature."""
    background_tasks.add_task(
        notification_service.create_notification,
        claim.owner,
        "request_status",
        title,
        body,
        f"/requests/{claim.loan_request.id}",
    )


def _notify_requester(
    claim: Claim, title: str, body: str, background_tasks: BackgroundTasks
) -> None:
    background_tasks.add_task(
        notification_service.create_notification,
        claim.requester,
        "request_status",
        title,
        body,
        f"/requests/{claim.loan_request.id}",
    )


def _maybe_clear_restriction(user: User, exclude_claim_id: str | None = None) -> None:
    """Only lift User.is_restricted if this was the last claim keeping
    them restricted — a user can have more than one loan_request overdue
    on a claim at the same time, and clearing the flag because just one
    of them got resolved would silently un-restrict someone who still
    owes money on another."""
    if not user.is_restricted:
        return
    qs = Claim.objects(requester=user, status__in=_RESTRICTING_STATUSES)
    if exclude_claim_id:
        qs = qs.filter(id__ne=exclude_claim_id)
    if qs.first():
        return
    user.update(is_restricted=False, updated_at=utcnow())


def assert_not_restricted(user: User) -> None:
    """Shared gate for the 3 actions a claim-restricted account can't take
    (request/accept a loan, list a new item) — see loan_request_service.
    lifecycle.create_request/accept_request and item_service.crud.
    create_item. Single source so the message/condition only needs
    updating in one place if the rule ever changes."""
    if user.is_restricted:
        raise errors.bad_request(
            "Sua conta está com uma pendência de sinistro. Regularize o "
            "pagamento pra continuar."
        )


def create_claim(
    request_id: str, data: ClaimCreate, current_user: User
) -> ClaimResponse:
    req = get_as_participant(request_id, current_user)
    if str(req.owner.id) != str(current_user.id):
        raise errors.forbidden("Only the owner can file a claim")
    if req.status not in ("in_progress", "finished"):
        raise errors.bad_request(
            "Só é possível registrar um sinistro depois de confirmar a devolução"
        )
    confirmation = req.return_confirmation
    confirmed_at = confirmation.confirmed_by_owner_at if confirmation else None
    if not confirmed_at:
        raise errors.bad_request(
            "Você precisa confirmar a devolução antes de registrar um sinistro"
        )
    window_hours = get_settings().claim_filing_window_hours
    if utcnow() - confirmed_at > timedelta(hours=window_hours):
        raise errors.bad_request(
            f"O prazo de {window_hours}h pra registrar um sinistro depois da "
            "confirmação de devolução já passou"
        )
    item = req.item
    if item.declared_value_cents is None:
        raise errors.bad_request(
            "Esse item não tem valor de reposição definido — não é possível "
            "registrar um sinistro"
        )
    mp_connected = bool(
        current_user.mp_connection and current_user.mp_connection.mp_user_id
    )
    if not mp_connected:
        raise errors.bad_request(
            "Conecte sua conta Mercado Pago antes de abrir um sinistro. "
            "Faça isso em /profile."
        )
    existing = Claim.objects(loan_request=req, status__in=_OPEN_CLAIM_STATUSES).first()
    if existing:
        raise errors.conflict("Já existe um sinistro em andamento pra esse pedido")
    requested_amount_cents = to_cents_required(data.requested_amount)
    if requested_amount_cents > item.declared_value_cents:
        raise errors.bad_request(
            "O valor pedido não pode passar do valor de reposição do item "
            f"(R$ {to_reais(item.declared_value_cents):.2f})"
        )

    claim = Claim(
        loan_request=req,
        item=item,
        owner=req.owner,
        requester=req.requester,
        description=data.description,
        requested_amount_cents=requested_amount_cents,
    )
    claim.save()
    _record_claim_activity(claim, "claim.filed", current_user)
    return _to_response(claim)


async def upload_claim_photo(
    claim_id: str, file: UploadFile, current_user: User
) -> ClaimResponse:
    claim = Claim.objects(id=claim_id).first()
    if not claim:
        raise errors.not_found("Claim not found")
    if str(claim.owner.id) != str(current_user.id):
        raise errors.forbidden("Not the claim's owner")
    if claim.status != "pending":
        raise errors.bad_request(
            "Só é possível anexar fotos enquanto o sinistro está pendente"
        )

    img = await load_and_resize(file)
    key = f"claims/{claim.id}/{uuid.uuid4().hex}.jpg"
    url = storage.save_public_image(img, key)
    claim.update(photos=(claim.photos or []) + [url], updated_at=utcnow())
    claim.reload()
    return _to_response(claim)


def get_claim(claim_id: str, current_user: User) -> ClaimResponse:
    claim = Claim.objects(id=claim_id).first()
    if not claim:
        raise errors.not_found("Claim not found")
    is_owner = str(claim.owner.id) == str(current_user.id)
    if not is_owner and not current_user.is_admin:
        raise errors.forbidden("Access denied")
    return _to_response(claim)


def list_claims(
    status_filter: str | None, skip: int = 0, limit: int = 100
) -> list[ClaimResponse]:
    qs = Claim.objects()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return [_to_response(c) for c in qs.order_by("-created_at").skip(skip).limit(limit)]


def _get_claim_in_status(claim_id: str, expected: str | list[str]) -> Claim:
    claim = Claim.objects(id=claim_id).first()
    if not claim:
        raise errors.not_found("Claim not found")
    expected_list = [expected] if isinstance(expected, str) else expected
    if claim.status not in expected_list:
        raise errors.bad_request(
            f"Claim isn't in {expected_list} (is '{claim.status}')"
        )
    return claim


def atomic_transition(
    claim_id: str, from_status: str | list[str], to_status: str, **fields
) -> Claim | None:
    """Compare-and-swap on Claim.status via MongoEngine's `.modify()` —
    the only safe way to move a claim between statuses when the
    transition gates a real Mercado Pago charge or payout decision
    (approve_claim, advance_paid_by_lendly) or must not silently clobber
    a concurrent one (cancel_claim, process_overdue_claims). A plain
    read-then-`.update()` lets two concurrent callers (a double-click, two
    admins, a cron tick racing a webhook) both read the same stale status
    and both proceed — with a real Pix charge, that means two real
    charges, not just a bookkeeping inconsistency. Returns None if
    `from_status` no longer matches by the time this runs — callers must
    treat that as "someone else already resolved this claim", not retry."""
    from_list = [from_status] if isinstance(from_status, str) else from_status
    return Claim.objects(id=claim_id, status__in=from_list).modify(
        new=True, status=to_status, updated_at=utcnow(), **fields
    )


def approve_claim(
    claim_id: str,
    approved_amount: float,
    admin: User,
    background_tasks: BackgroundTasks,
) -> ClaimResponse:
    claim = _get_claim_in_status(claim_id, "pending")
    declared_value_cents = claim.item.declared_value_cents or 0
    approved_amount_cents = to_cents_required(approved_amount)
    if approved_amount_cents <= 0 or approved_amount_cents > declared_value_cents:
        raise errors.bad_request(
            "O valor aprovado precisa estar entre R$ 0,01 e "
            f"R$ {to_reais_required(declared_value_cents):.2f}"
        )

    updated = atomic_transition(
        str(claim.id),
        "pending",
        "approved",
        approved_amount_cents=approved_amount_cents,
        reviewed_by=admin,
        reviewed_at=utcnow(),
    )
    if not updated:
        raise errors.conflict("Esse sinistro já não está mais pendente")
    claim = updated

    try:
        payment_service.create_payment_for_claim(claim)
    except Exception:
        # Compensate — Mongo has no easy multi-doc transaction here, so
        # this is a manual rollback rather than an atomic one. Admin just
        # clicks Aprovar again once whatever failed is sorted out.
        claim.update(
            status="pending",
            unset__approved_amount_cents=1,
            unset__reviewed_by=1,
            unset__reviewed_at=1,
            updated_at=utcnow(),
        )
        raise

    claim.reload()
    _record_claim_activity(claim, "claim.approved", admin)
    _notify_owner(
        claim,
        "Seu sinistro foi aprovado",
        f"Aprovamos R$ {approved_amount:.2f} pra {claim.item.title}. "
        "Uma cobrança Pix foi enviada pra quem pegou o item emprestado.",
        background_tasks,
    )
    _notify_requester(
        claim,
        "Sinistro aprovado — pagamento pendente",
        f"O sinistro de R$ {approved_amount:.2f} pra {claim.item.title} foi "
        "aprovado. Pague a cobrança Pix dentro do prazo pra evitar o "
        "bloqueio da sua conta.",
        background_tasks,
    )
    return _to_response(claim)


def reject_claim(
    claim_id: str, reason: str, admin: User, background_tasks: BackgroundTasks
) -> ClaimResponse:
    claim = atomic_transition(
        claim_id,
        "pending",
        "rejected",
        rejection_reason=reason,
        reviewed_by=admin,
        reviewed_at=utcnow(),
    )
    if not claim:
        raise errors.conflict("Esse sinistro já não está mais pendente")
    _record_claim_activity(claim, "claim.rejected", admin)
    _notify_owner(
        claim,
        "Seu sinistro foi recusado",
        f"O sinistro pra {claim.item.title} foi recusado: {reason}",
        background_tasks,
    )
    return _to_response(claim)


def mark_claim_paid(
    claim_id: str, admin: User, background_tasks: BackgroundTasks
) -> ClaimResponse:
    """Manual fallback only — the happy path marks a claim paid
    automatically via the Pix webhook (see mark_claim_paid_by_payment).
    Kept as an admin escape hatch for a stuck/missed webhook, same
    reasoning as the rest of the payment flow having no automatic retry
    (see docs/pagamento-online.md)."""
    claim = atomic_transition(
        claim_id, _PAYABLE_STATUSES, "paid", paid_by=admin, paid_at=utcnow()
    )
    if not claim:
        raise errors.conflict("Esse sinistro já não está mais pagável")
    _maybe_clear_restriction(claim.requester)
    _record_claim_activity(claim, "claim.paid", admin)
    _notify_owner(
        claim,
        "Seu sinistro foi pago",
        f"O valor de R$ {to_reais(claim.approved_amount_cents):.2f} pra "
        f"{claim.item.title} foi pago.",
        background_tasks,
    )
    return _to_response(claim)


def mark_claim_paid_by_payment(
    payment: Payment, background_tasks: BackgroundTasks
) -> None:
    """Called from payment_service.handle_webhook once a kind="claim" or
    kind="claim_debt" Pix charge is confirmed — the automatic happy path
    that mark_claim_paid above used to require an admin click for."""
    if not payment.claim:
        return
    claim = atomic_transition(
        str(payment.claim.id), _PAYABLE_STATUSES, "paid", paid_at=utcnow()
    )
    if not claim:
        return
    _maybe_clear_restriction(claim.requester)
    _record_claim_activity(claim, "claim.paid")
    _notify_owner(
        claim,
        "Seu sinistro foi pago",
        f"O valor de R$ {to_reais(claim.approved_amount_cents):.2f} pra "
        f"{claim.item.title} foi pago.",
        background_tasks,
    )
    if payment.kind == "claim_debt":
        _notify_requester(
            claim,
            "Dívida quitada",
            f"Sua dívida de R$ {to_reais_required(payment.gross_amount_cents):.2f} "
            "com a Lendly foi paga — sua conta não está mais restrita.",
            background_tasks,
        )


def advance_paid_by_lendly(
    claim_id: str, admin: User, background_tasks: BackgroundTasks
) -> ClaimResponse:
    """Admin confirms the platform manually transferred the owner outside
    the platform (no automated payout exists, see docs/pagamento-online.md)
    for an overdue PAID-item claim — flips the requester's debt from
    "owed to the owner" to "owed to the platform, plus a late fee" and
    generates the new Pix charge for that. Free items have no equivalent:
    there's no guarantee fee collected on that transaction for the
    platform to be advancing in the first place."""
    claim = _get_claim_in_status(claim_id, "overdue")
    if claim.item.availability_type != "paid":
        raise errors.bad_request(
            "Só itens pagos têm essa opção — item grátis nunca tem adiantamento "
            "da Lendly"
        )

    # Atomic claim on "overdue" FIRST, before any real Pix charge is
    # created — a double-click or two admins confirming the same overdue
    # claim at once must not both reach create_payment_for_claim_debt,
    # or the requester ends up with two real debt charges (see
    # atomic_transition's docstring).
    updated = atomic_transition(
        claim_id,
        "overdue",
        "advanced_by_lendly",
        advanced_by=admin,
        advanced_at=utcnow(),
    )
    if not updated:
        raise errors.conflict("Esse sinistro já não está mais vencido")
    claim = updated

    try:
        payment_service.create_payment_for_claim_debt(claim)
    except Exception:
        # Compensate — nothing charged yet, safe to just revert the
        # status so the admin can retry (same pattern as approve_claim).
        claim.update(
            status="overdue",
            unset__advanced_by=1,
            unset__advanced_at=1,
            updated_at=utcnow(),
        )
        raise

    original_payment = Payment.objects(
        claim=claim, kind="claim", status="pending"
    ).first()
    if original_payment:
        # Prevents the original charge from being paid later and landing
        # straight in the owner's account after the platform already
        # advanced them — see claim_service module notes.
        original_payment.update(status="superseded", updated_at=utcnow())

    claim.reload()
    _record_claim_activity(claim, "claim.advanced_by_lendly", admin)
    _notify_requester(
        claim,
        "Sua conta está restrita — pagamento pendente com a Lendly",
        f"A Lendly já pagou {claim.owner.name} pelo sinistro em {claim.item.title}. "
        "Você agora deve esse valor (com multa por atraso) à Lendly. Pague pra "
        "desbloquear sua conta.",
        background_tasks,
    )
    return _to_response(claim)


def cancel_claim(
    claim_id: str, reason: str, admin: User, background_tasks: BackgroundTasks
) -> ClaimResponse:
    """Voids an approved/overdue claim — deliberately NOT available once a
    claim reaches "advanced_by_lendly": at that point the platform has
    already paid the owner for real, so "cancelling" would leave the
    platform out of pocket with no way to recover it through this simple
    action. That state needs a human resolving it some other way, not a
    one-click cancel."""
    # Atomic claim on approved/overdue FIRST — if advance_paid_by_lendly
    # concurrently already moved this claim to "advanced_by_lendly" (the
    # platform already paid the owner for real), this CAS simply fails to
    # match and cancel_claim cleanly reports a conflict instead of
    # clobbering that transition back to "cancelled" and superseding the
    # debt-recovery charge it just created (see atomic_transition's
    # docstring, and this function's own docstring above).
    claim = atomic_transition(
        claim_id,
        ["approved", "overdue"],
        "cancelled",
        cancelled_by=admin,
        cancelled_at=utcnow(),
        cancellation_reason=reason,
    )
    if not claim:
        raise errors.conflict("Esse sinistro já não está mais em um estado cancelável")
    active_payment = Payment.objects(
        claim=claim, kind__in=["claim", "claim_debt"], status="pending"
    ).first()
    if active_payment:
        active_payment.update(status="superseded", updated_at=utcnow())
    _maybe_clear_restriction(claim.requester, exclude_claim_id=str(claim.id))
    _record_claim_activity(claim, "claim.cancelled", admin)
    _notify_owner(
        claim,
        "Sinistro cancelado",
        f"O sinistro pra {claim.item.title} foi cancelado: {reason}",
        background_tasks,
    )
    _notify_requester(
        claim,
        "Sinistro cancelado",
        f"O sinistro pra {claim.item.title} foi cancelado: {reason}",
        background_tasks,
    )
    return _to_response(claim)


def get_fund_summary() -> FundSummaryResponse:
    collected_cents = sum(
        p.guarantee_fee_amount_cents or 0
        for p in Payment.objects(status__in=["held", "released"])
    )
    paid_out_cents = sum(
        c.approved_amount_cents or 0 for c in Claim.objects(status="paid")
    )
    return FundSummaryResponse(
        collected=to_reais_required(collected_cents),
        paid_out=to_reais_required(paid_out_cents),
        balance=to_reais_required(collected_cents - paid_out_cents),
    )
