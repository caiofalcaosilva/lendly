import csv
import io
from datetime import datetime

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.services import admin_activity_service
from app.utils.money import to_reais


def _write_csv(header: list, rows: list) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue()


def export_users_csv() -> str:
    header = [
        "id",
        "nome",
        "email",
        "tipo_conta",
        "cidade",
        "bairro",
        "ativo",
        "admin",
        "nota_media",
        "numero_avaliacoes",
        "emprestimos_finalizados",
        "cadastro",
    ]
    rows = [
        [
            str(u.id),
            u.name,
            u.email,
            u.account_type or "individual",
            u.address.city,
            u.address.neighborhood,
            u.is_active,
            u.is_admin or False,
            u.reputation.average_rating,
            u.reputation.rating_count,
            u.reputation.finished_loans_count or 0,
            u.created_at.isoformat(),
        ]
        for u in User.objects(is_system_account__ne=True).order_by("created_at")
    ]
    return _write_csv(header, rows)


def export_items_csv() -> str:
    header = [
        "id",
        "titulo",
        "categoria",
        "subcategoria",
        "dono",
        "cidade",
        "ativo",
        "tipo",
        "valor_diario",
        "cadastro",
    ]
    rows = [
        [
            str(i.id),
            i.title,
            i.category,
            i.subcategory or "",
            i.owner.name,
            i.city,
            i.is_active,
            i.availability_type,
            to_reais(i.daily_rate_cents) if i.availability_type == "paid" else "",
            i.created_at.isoformat(),
        ]
        for i in Item.objects().order_by("created_at").select_related(max_depth=1)
    ]
    return _write_csv(header, rows)


def export_loan_requests_csv() -> str:
    header = [
        "id",
        "item",
        "solicitante",
        "dono",
        "status",
        "retirada",
        "devolucao_prevista",
        "devolucao_real",
        "criado_em",
    ]
    rows = [
        [
            str(r.id),
            r.item.title,
            r.requester.name,
            r.owner.name,
            r.status,
            r.pickup_date.isoformat(),
            r.expected_return_date.isoformat(),
            r.actual_return_date.isoformat() if r.actual_return_date else "",
            r.created_at.isoformat(),
        ]
        for r in LoanRequest.objects()
        .order_by("created_at")
        .select_related(max_depth=1)
    ]
    return _write_csv(header, rows)


def export_activities_csv(
    recipient_id: str | None = None,
    actor_id: str | None = None,
    event: str | None = None,
    resource_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> str:
    """Same filters as GET /admin/activities — exports whatever the admin
    currently has filtered in that search, not the whole collection, since
    Activity has no natural per-page size the way users/items/loan
    requests do."""
    header = [
        "id",
        "evento",
        "ator",
        "destinatario",
        "tipo_recurso",
        "recurso",
        "criado_em",
    ]
    qs = admin_activity_service.build_queryset(
        recipient_id, actor_id, event, resource_type, date_from, date_to
    )
    rows = [
        [
            str(a.id),
            a.event,
            a.actor_name or "",
            a.recipient.name,
            a.resource_type,
            a.resource_title or a.resource_id,
            a.created_at.isoformat(),
        ]
        for a in qs.order_by("created_at").select_related(max_depth=1)
    ]
    return _write_csv(header, rows)
