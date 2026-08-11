from mongoengine import DateTimeField, DictField, Document, ReferenceField, StringField

from app.utils.time import utcnow

ACTIVITY_EVENTS = [
    "item.created",
    "item.updated",
    "item.paused",
    "item.resumed",
    "item.removed",
    "rental.requested",
    "rental.accepted",
    "rental.refused",
    "rental.pickup_confirmed",
    "rental.started",
    "rental.pickup_forced",
    "rental.return_confirmed",
    "rental.finished",
    "rental.return_forced",
    "rental.cancelled",
    "rental.extension_requested",
    "rental.extension_approved",
    "rental.extension_rejected",
    "payment.held",
    "payment.released",
    "payment.refunded",
    "payment.failed",
    "review.submitted",
    "verification.submitted",
    "verification.approved",
    "verification.rejected",
    "group.created",
    "group.joined",
    "group.left",
    "group.deleted",
    "group.vouch_received",
    "group.vouch_withdrawn",
    "report.filed",
    "account.new_login",
    "account.password_changed",
    "account.email_changed",
    "account.paused",
    "account.resumed",
    "account.2fa_enabled",
    "account.2fa_disabled",
    "account.password_reset",
    "account.session_revoked",
    "account.mercadopago_connected",
    "account.data_exported",
    "admin.user_activated",
    "admin.user_deactivated",
    "admin.user_promoted",
    "admin.user_demoted",
    "admin.item_activated",
    "admin.item_deactivated",
    "admin.report_dismissed",
    "admin.report_actioned",
    "admin.group_deleted",
    "admin.group_member_removed",
    "admin.review_deleted",
    "admin.user_viewed",
]


class Activity(Document):
    """Persistent, user-visible history — one document per recipient, never
    edited after creation. Distinct from `Notification` (opt-out, has a
    read/unread state, deletable): this is append-only and always written,
    a record of what happened rather than an alert to act on.

    `resource_type`/`resource_id` are plain strings rather than a
    GenericReferenceField — the target can be an Item, LoanRequest,
    Payment, Review, VerificationSubmission, Report or Group, and some of
    those (Group, and Review via moderation) can be hard-deleted, unlike
    User/Item which are only ever soft-deleted. `actor_name`/
    `resource_title` are snapshots so the rendered line never depends on a
    dereference or breaks if the source document's name/title changes
    later.

    See docs/historico-de-atividades.md for the full event catalog, the
    recipient rules and the "never put in metadata" list.
    """

    recipient = ReferenceField("User", required=True)
    event = StringField(required=True, choices=ACTIVITY_EVENTS)
    actor = ReferenceField("User")
    actor_name = StringField(max_length=100)
    resource_type = StringField(required=True)
    resource_id = StringField(required=True)
    resource_title = StringField(max_length=200)
    metadata = DictField()
    created_at = DateTimeField(default=utcnow)

    meta = {
        "collection": "activities",
        "indexes": [
            {"fields": ["recipient", "-created_at"]},
            {"fields": ["recipient", "event", "-created_at"]},
            {"fields": ["resource_type", "resource_id"]},
        ],
    }
