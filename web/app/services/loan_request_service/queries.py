from app.models.loan_request import LoanRequest
from app.models.user import User
from app.schemas.loan_request import LoanRequestResponse
from app.services.loan_request_service._common import to_response_many


def get_sent_requests(current_user: User) -> list[LoanRequestResponse]:
    reqs = (
        LoanRequest.objects(requester=current_user)
        .order_by("-created_at")
        .select_related(max_depth=1)
    )
    return to_response_many(list(reqs), viewer=current_user)


def get_received_requests(current_user: User) -> list[LoanRequestResponse]:
    reqs = (
        LoanRequest.objects(owner=current_user)
        .order_by("-created_at")
        .select_related(max_depth=1)
    )
    return to_response_many(list(reqs), viewer=current_user)


def get_history(current_user: User) -> list[LoanRequestResponse]:
    reqs = (
        LoanRequest.objects(
            status__in=["finished", "cancelled", "refused"],
            __raw__={
                "$or": [{"requester": current_user.id}, {"owner": current_user.id}]
            },
        )
        .order_by("-updated_at")
        .select_related(max_depth=1)
    )
    return to_response_many(list(reqs), viewer=current_user)
