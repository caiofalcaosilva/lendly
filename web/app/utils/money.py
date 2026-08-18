def to_cents(reais: float | None) -> int | None:
    return round(reais * 100) if reais is not None else None


def to_reais(cents: int | None) -> float | None:
    return cents / 100 if cents is not None else None


# Non-optional variants for fields that are always set (required model
# fields, or a value just computed locally) — avoids sprinkling `assert x
# is not None`/`# type: ignore` at call sites that mypy otherwise can't
# tell apart from the genuinely-optional ones above.
def to_cents_required(reais: float) -> int:
    return round(reais * 100)


def to_reais_required(cents: int) -> float:
    return cents / 100
