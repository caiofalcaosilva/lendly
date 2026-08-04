import csv
import io

from app.models.item import Item
from app.models.loan_request import LoanRequest
from app.models.user import User


def _write_csv(header: list, rows: list) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue()


def export_users_csv() -> str:
    header = [
        "id", "nome", "email", "tipo_conta", "cidade", "bairro", "ativo", "admin",
        "nota_media", "numero_avaliacoes", "emprestimos_finalizados", "cadastro",
    ]
    rows = [
        [
            str(u.id), u.name, u.email, u.account_type or "individual", u.city, u.neighborhood,
            u.is_active, u.is_admin or False, u.average_rating, u.rating_count,
            u.finished_loans_count or 0, u.created_at.isoformat(),
        ]
        for u in User.objects().order_by("created_at")
    ]
    return _write_csv(header, rows)


def export_items_csv() -> str:
    header = [
        "id", "titulo", "categoria", "subcategoria", "dono", "cidade", "ativo",
        "tipo", "valor_diario", "cadastro",
    ]
    rows = [
        [
            str(i.id), i.title, i.category, i.subcategory or "", i.owner.name, i.city,
            i.is_active, i.availability_type, i.daily_rate if i.availability_type == "paid" else "",
            i.created_at.isoformat(),
        ]
        for i in Item.objects().order_by("created_at")
    ]
    return _write_csv(header, rows)


def export_loan_requests_csv() -> str:
    header = [
        "id", "item", "solicitante", "dono", "status", "retirada",
        "devolucao_prevista", "devolucao_real", "criado_em",
    ]
    rows = [
        [
            str(r.id), r.item.title, r.requester.name, r.owner.name, r.status,
            r.pickup_date.isoformat(), r.expected_return_date.isoformat(),
            r.actual_return_date.isoformat() if r.actual_return_date else "",
            r.created_at.isoformat(),
        ]
        for r in LoanRequest.objects().order_by("created_at")
    ]
    return _write_csv(header, rows)
