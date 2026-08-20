from app.models.user import User

SYSTEM_ACCOUNT_EMAIL = "sistema@lendly.com.br"


def get_system_account() -> User:
    """Lazy get-or-create, same pattern as platform_settings_service's
    singleton — the one User that receives kind="claim_debt" Payments
    when the platform has advanced a claim's owner and is collecting the
    debt back from the requester (see claim_service.advance_paid_by_lendly).
    is_active=False so it never logs in and is naturally excluded from
    the ~15 places that filter on that field."""
    account = User.objects(email=SYSTEM_ACCOUNT_EMAIL).first()
    if not account:
        account = User(
            name="Lendly",
            email=SYSTEM_ACCOUNT_EMAIL,
            is_system_account=True,
            is_active=False,
            is_verified=True,
        )
        account.save()
    return account
