from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.loan_request import LoanRequestCreate, LoanRequestResponse
from app.services import loan_request_service

router = APIRouter(prefix="/requests", tags=["loan_requests"])


@router.post("/", response_model=LoanRequestResponse, status_code=201)
def create_request(data: LoanRequestCreate, current_user: User = Depends(get_current_user)):
    return loan_request_service.create_request(data, current_user)


@router.get("/{request_id}", response_model=LoanRequestResponse)
def get_request(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.get_request(request_id, current_user)


@router.patch("/{request_id}/accept", response_model=LoanRequestResponse)
def accept(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.accept_request(request_id, current_user)


@router.patch("/{request_id}/refuse", response_model=LoanRequestResponse)
def refuse(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.refuse_request(request_id, current_user)


@router.patch("/{request_id}/start", response_model=LoanRequestResponse)
def start(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.start_request(request_id, current_user)


@router.patch("/{request_id}/finish", response_model=LoanRequestResponse)
def finish(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.finish_request(request_id, current_user)


@router.patch("/{request_id}/cancel", response_model=LoanRequestResponse)
def cancel(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.cancel_request(request_id, current_user)
