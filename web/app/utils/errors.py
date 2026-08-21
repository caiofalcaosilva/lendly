from fastapi import HTTPException, status


def _error(
    status_code: int, detail: str, headers: dict[str, str] | None = None
) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail, headers=headers)


def bad_request(detail: str) -> HTTPException:
    return _error(status.HTTP_400_BAD_REQUEST, detail)


def unauthorized(detail: str, headers: dict[str, str] | None = None) -> HTTPException:
    return _error(status.HTTP_401_UNAUTHORIZED, detail, headers)


def forbidden(detail: str) -> HTTPException:
    return _error(status.HTTP_403_FORBIDDEN, detail)


def not_found(detail: str) -> HTTPException:
    return _error(status.HTTP_404_NOT_FOUND, detail)


def conflict(detail: str) -> HTTPException:
    return _error(status.HTTP_409_CONFLICT, detail)


def bad_gateway(detail: str) -> HTTPException:
    return _error(status.HTTP_502_BAD_GATEWAY, detail)


def too_many_requests(detail: str) -> HTTPException:
    return _error(status.HTTP_429_TOO_MANY_REQUESTS, detail)
