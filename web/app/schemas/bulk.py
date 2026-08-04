from typing import List

from pydantic import BaseModel, Field


class BulkActionRequest(BaseModel):
    ids: List[str] = Field(..., min_length=1)


class BulkActionFailure(BaseModel):
    id: str
    reason: str


class BulkActionResult(BaseModel):
    succeeded: List[str]
    failed: List[BulkActionFailure]
