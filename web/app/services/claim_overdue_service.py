import logging
from datetime import timedelta

from app.models.payment import Payment
from app.services import notification_service
from app.services.claim_service import atomic_transition
from app.services.platform_settings_service import get_settings
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


async def process_overdue_claims() -> int:
    """Finds approved claims whose Pix charge (requester -> owner) has
    gone unpaid past platform_settings.claim_payment_deadline_days,
    marks them "overdue", and restricts the requester's account (see
    User.is_restricted). Idempotent by construction: once a claim moves
    off "approved", the query below stops matching it — no separate
    sentinel field needed. Meant to run on a daily schedule (see main.py).

    Doesn't do anything about the "Lendly advances the owner" step for
    paid items — that stays an explicit admin action
    (claim_service.advance_paid_by_lendly), since it involves the
    platform actually moving money and there's no automated payout to
    trigger here (see docs/pagamento-online.md)."""
    cutoff = utcnow() - timedelta(days=get_settings().claim_payment_deadline_days)
    overdue_payments = Payment.objects(
        kind="claim", status="pending", created_at__lte=cutoff
    ).select_related(max_depth=1)

    marked = 0
    for payment in overdue_payments:
        if not payment.claim:
            continue
        # Atomic claim on "approved" — payment.claim came from the
        # select_related() prefetch above and may be a stale snapshot; a
        # webhook could confirm this exact claim's payment in the window
        # between that prefetch and this loop reaching it. Without this
        # compare-and-swap, that race would restrict the account of
        # someone who just paid on time. See claim_service.atomic_
        # transition's docstring for why a plain read-then-write isn't safe.
        claim = atomic_transition(str(payment.claim.id), "approved", "overdue")
        if not claim:
            continue
        claim.requester.update(
            is_restricted=True,
            restricted_reason=f"Sinistro #{claim.id} vencido",
            restricted_at=utcnow(),
        )
        marked += 1

        item_title = claim.item.title
        await notification_service.create_notification(
            claim.requester,
            "request_status",
            "Sinistro vencido — sua conta está restrita",
            f"O prazo pra pagar o sinistro de {item_title} passou. Pague a "
            "cobrança pendente pra voltar a solicitar/anunciar itens.",
            f"/requests/{claim.loan_request.id}",
        )
        await notification_service.create_notification(
            claim.owner,
            "request_status",
            "Sinistro vencido",
            f"Quem pegou {item_title} emprestado não pagou o sinistro no "
            "prazo. Um admin vai revisar o caso.",
            f"/requests/{claim.loan_request.id}",
        )

    if marked:
        logger.info(
            "overdue claims processed",
            extra={
                "payments_checked": len(overdue_payments),
                "claims_marked_overdue": marked,
            },
        )
    return marked
