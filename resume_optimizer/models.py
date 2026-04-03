from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class BulletInput(BaseModel):
    text: str = Field(..., min_length=1, description="Single resume bullet or short duty line")
    role: Optional[str] = None
    target_company: Optional[str] = None
    job_description: Optional[str] = None


class BulletScore(BaseModel):
    impact: int = Field(..., ge=0, le=10)
    clarity: int = Field(..., ge=0, le=10)
    specificity: int = Field(..., ge=0, le=10, description="Role-relevant detail (tools, patients, revenue, curriculum, etc.)")
    has_metrics: bool = False
    suggestions: List[str] = Field(default_factory=list)


class BulletOutput(BaseModel):
    domain: str
    improved_versions: List[str]
    score: BulletScore
