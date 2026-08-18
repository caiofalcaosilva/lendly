import uuid

from fastapi import BackgroundTasks, UploadFile

from app.models.claim import Claim
from app.models.payment import Payment
from app.models.user import User
from app.schemas.claim import (
    ClaimCreate,
    ClaimResponse,
    FundSummaryResponse,
)
from app.services import activity_service, notification_service, storage
from app.services.loan_request_service._common import get_as_participant
from app.utils import errors
from app.utils.images import load_and_resize
from app.utils.money import to_cents_required, to_reais, to_reais_required
from app.utils.time import utcnow

# How long after the item comes back the owner has to file a claim.
CLAIM_WINDOW_DAYS = 7


def _to_response(claim: Claim) -> ClaimResponse:
    return ClaimResponse(
        id=str(claim.id),
        loan_request_id=str(claim.loan_request.id),
        item_id=str(claim.item.id),
        item_title=claim.item.title,
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


def create_claim(
    request_id: str, data: ClaimCreate, current_user: User
) -> ClaimResponse:
    req = get_as_participant(request_id, current_user)
    if str(req.owner.id) != str(current_user.id):
        raise errors.forbidden("Only the owner can file a claim")
    if req.status != "finished":
        raise errors.bad_request("O empréstimo precisa estar finalizado")
    item = req.item
    if item.declared_value_cents is None:
        raise errors.bad_request(
            "Esse item não tem valor de reposição definido — não é possível "
            "registrar um sinistro"
        )
    if (
        req.actual_return_date
        and (utcnow() - req.actual_return_date).days > CLAIM_WINDOW_DAYS
    ):
        raise errors.bad_request(
            f"O prazo de {CLAIM_WINDOW_DAYS} dias pra registrar um sinistro "
            "depois da devolução já passou"
        )
    existing = Claim.objects(
        loan_request=req, status__in=["pending", "approved"]
    ).first()
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


def _get_claim_in_status(claim_id: str, expected: str) -> Claim:
    claim = Claim.objects(id=claim_id).first()
    if not claim:
        raise errors.not_found("Claim not found")
    if claim.status != expected:
        raise errors.bad_request(f"Claim isn't '{expected}' (is '{claim.status}')")
    return claim


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
    claim.update(
        status="approved",
        approved_amount_cents=approved_amount_cents,
        reviewed_by=admin,
        reviewed_at=utcnow(),
        updated_at=utcnow(),
    )
    claim.reload()
    _record_claim_activity(claim, "claim.approved", admin)
    _notify_owner(
        claim,
        "Seu sinistro foi aprovado",
        f"Aprovamos R$ {approved_amount:.2f} pra {claim.item.title}.",
        background_tasks,
    )
    return _to_response(claim)


def reject_claim(
    claim_id: str, reason: str, admin: User, background_tasks: BackgroundTasks
) -> ClaimResponse:
    claim = _get_claim_in_status(claim_id, "pending")
    claim.update(
        status="rejected",
        rejection_reason=reason,
        reviewed_by=admin,
        reviewed_at=utcnow(),
        updated_at=utcnow(),
    )
    claim.reload()
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
    claim = _get_claim_in_status(claim_id, "approved")
    claim.update(status="paid", paid_by=admin, paid_at=utcnow(), updated_at=utcnow())
    claim.reload()
    _record_claim_activity(claim, "claim.paid", admin)
    _notify_owner(
        claim,
        "Seu sinistro foi pago",
        f"O valor de R$ {to_reais(claim.approved_amount_cents):.2f} pra "
        f"{claim.item.title} foi pago.",
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
