from collections.abc import Callable

from fastapi import HTTPException

from app.models.user import User
from app.schemas.bulk import BulkActionFailure, BulkActionResult


def run_bulk(
    ids: list[str], admin: User, action: Callable[[str, User], object]
) -> BulkActionResult:
    """Best-effort — one id's failure (self-action, active loan, not found,
    ...) doesn't stop the rest of the batch from going through."""
    succeeded: list[str] = []
    failed: list[BulkActionFailure] = []
    for item_id in ids:
        try:
            action(item_id, admin)
            succeeded.append(item_id)
        except HTTPException as e:
            failed.append(BulkActionFailure(id=item_id, reason=str(e.detail)))
    return BulkActionResult(succeeded=succeeded, failed=failed)
