from pydantic import BaseModel, Field


class BulkActionRequest(BaseModel):
    ids: list[str] = Field(..., min_length=1)


class BulkActionFailure(BaseModel):
    id: str
    reason: str


class BulkActionResult(BaseModel):
    succeeded: list[str]
    failed: list[BulkActionFailure]
