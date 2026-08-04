from typing import List

from app.models.category import Category, Subcategory
from app.schemas.category import CategoryResponse, SubcategoryResponse

# One-time seed data, mirroring the old hardcoded ItemCategory enum +
# SUBCATEGORIES dict (same keys, so existing items' category/subcategory
# values keep matching after the switch to a DB-backed source of truth).
_SEED = [
    ("tools", "Ferramentas", [
        ("electric", "Elétricas"), ("manual", "Manuais"),
        ("gardening", "Jardinagem"), ("measuring", "Medição"),
    ]),
    ("electronics", "Eletrônicos", [
        ("audio_video", "Áudio e vídeo"), ("computers", "Informática"),
        ("cameras", "Câmeras"), ("games", "Games"),
    ]),
    ("sports", "Esportes", [
        ("fitness", "Fitness"), ("cycling", "Ciclismo"),
        ("water_sports", "Esportes aquáticos"), ("camping", "Camping"),
    ]),
    ("garden", "Jardim", [
        ("gardening", "Jardinagem"), ("landscaping", "Paisagismo"),
        ("outdoor_furniture", "Móveis externos"),
    ]),
    ("kitchen", "Cozinha", [
        ("appliances", "Eletroportáteis"), ("utensils", "Utensílios"),
        ("dishware", "Louças e talheres"),
    ]),
    ("books", "Livros", [
        ("fiction", "Ficção"), ("non_fiction", "Não-ficção"),
        ("children", "Infantil"), ("textbooks", "Didáticos"),
    ]),
    ("toys", "Brinquedos", [
        ("educational", "Educativos"), ("outdoor", "Ar livre"),
        ("board_games", "Jogos de tabuleiro"),
    ]),
    ("clothing", "Roupas", [
        ("costumes", "Festas e fantasias"), ("sportswear", "Esportiva"), ("winter", "Inverno"),
    ]),
    ("furniture", "Móveis", [
        ("living_room", "Sala"), ("bedroom", "Quarto"),
        ("office", "Escritório"), ("outdoor", "Área externa"),
    ]),
    ("other", "Outros", []),
]


def _seed_if_empty() -> None:
    if Category.objects().first():
        return
    for key, label, subs in _SEED:
        Category(
            key=key,
            label=label,
            subcategories=[Subcategory(key=sk, label=sl) for sk, sl in subs],
        ).save()


def to_response(c: Category) -> CategoryResponse:
    return CategoryResponse(
        key=c.key,
        label=c.label,
        is_active=c.is_active,
        subcategories=[
            SubcategoryResponse(key=s.key, label=s.label, is_active=s.is_active) for s in c.subcategories
        ],
    )


def list_all() -> List[CategoryResponse]:
    _seed_if_empty()
    return [to_response(c) for c in Category.objects().order_by("label")]


def list_active() -> List[CategoryResponse]:
    _seed_if_empty()
    active = []
    for c in Category.objects(is_active=True).order_by("label"):
        resp = to_response(c)
        resp.subcategories = [s for s in resp.subcategories if s.is_active]
        active.append(resp)
    return active


def is_valid_category(key: str) -> bool:
    _seed_if_empty()
    return Category.objects(key=key, is_active=True).first() is not None


def is_valid_subcategory(category_key: str, subcategory_key: str) -> bool:
    _seed_if_empty()
    category = Category.objects(key=category_key, is_active=True).first()
    if not category:
        return False
    return any(s.key == subcategory_key and s.is_active for s in category.subcategories)
