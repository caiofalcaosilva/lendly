"""Split by responsibility across this package's modules (lifecycle,
extensions, reliability, queries) — re-exported here so callers keep using
`loan_request_service.create_request` etc. exactly as before the split.

`_get_as_participant` is re-exported too — message_service.py reaches into
it directly to check chat access, the one place outside this package that
touches a "private" helper."""

from app.services.loan_request_service._common import get_as_participant
from app.services.loan_request_service.extensions import (
    approve_extension,
    reject_extension,
    request_extension,
)
from app.services.loan_request_service.lifecycle import (
    accept_request,
    cancel_request,
    create_request,
    finish_request,
    get_request,
    refuse_request,
    start_request,
)
from app.services.loan_request_service.queries import (
    get_history,
    get_received_requests,
    get_sent_requests,
)

_get_as_participant = get_as_participant

__all__ = [
    "accept_request",
    "approve_extension",
    "cancel_request",
    "create_request",
    "finish_request",
    "get_history",
    "get_received_requests",
    "get_request",
    "get_sent_requests",
    "refuse_request",
    "reject_extension",
    "request_extension",
    "start_request",
]
