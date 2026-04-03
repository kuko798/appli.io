"""Domain-agnostic resume bullet analysis and rewrite pipeline (OpenAI-compatible LLM)."""

from .models import BulletInput, BulletOutput, BulletScore
from .pipeline import rewrite_bullet

__all__ = ["BulletInput", "BulletOutput", "BulletScore", "rewrite_bullet"]
