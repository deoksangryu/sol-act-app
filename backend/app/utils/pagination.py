from fastapi import Query
from typing import Optional


def pagination_params(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    return {"skip": skip, "limit": limit}
