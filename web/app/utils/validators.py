import re


def _check_digit(digits: list, weights: list) -> int:
    total = sum(d * w for d, w in zip(digits, weights, strict=False))
    remainder = total % 11
    return 0 if remainder < 2 else 11 - remainder


def is_valid_cnpj(cnpj: str) -> bool:
    """Validates a Brazilian CNPJ (company registry ID) via its two check
    digits — standard mod-11 weighted-sum algorithm. Accepts digits-only or
    the punctuated form (XX.XXX.XXX/YYYY-ZZ)."""
    digits_str = re.sub(r"\D", "", cnpj or "")
    if len(digits_str) != 14 or digits_str == digits_str[0] * 14:
        return False

    digits = [int(d) for d in digits_str]
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    if _check_digit(digits[:12], weights1) != digits[12]:
        return False
    return _check_digit(digits[:13], weights2) == digits[13]


def is_valid_cpf(cpf: str) -> bool:
    """Validates a Brazilian CPF (individual taxpayer ID) via its two check
    digits — standard mod-11 weighted-sum algorithm. Accepts digits-only or
    the punctuated form (XXX.XXX.XXX-YY)."""
    digits_str = re.sub(r"\D", "", cpf or "")
    if len(digits_str) != 11 or digits_str == digits_str[0] * 11:
        return False

    digits = [int(d) for d in digits_str]
    weights1 = [10, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]

    if _check_digit(digits[:9], weights1) != digits[9]:
        return False
    return _check_digit(digits[:10], weights2) == digits[10]
