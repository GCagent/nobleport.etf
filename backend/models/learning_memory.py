"""
NoblePort Learning Memory Model

Persistent form of a recursive-learning memory. Each row is one stored learning
cycle: the topic, its self-assessed depth and confidence, the evidence and
counterargument counts behind those scores, the cross-domain connections drawn,
the knowledge gaps still open, the Truth-Layer tag it carries, and the hash-chain
links that make the learning log tamper-evident (mirroring TrustRecord).
"""

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class LearningMemory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "learning_memories"

    # What was learned
    topic: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Self-assessment
    depth_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Evidence behind the scores
    sources: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    counterarguments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # JSON-encoded lists (kept as Text for SQLite/Postgres portability)
    connections: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    knowledge_gaps: Mapped[str] = mapped_column(Text, default="[]", nullable=False)

    # Governance
    tag: Mapped[str] = mapped_column(String(20), default="SIMULATED", nullable=False)

    # Review scheduling
    next_review: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Chain integrity
    record_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True
    )
    prev_hash: Mapped[str] = mapped_column(String(128), nullable=False)

    def __repr__(self) -> str:
        return (
            f"<LearningMemory {self.topic!r} depth={self.depth_score} "
            f"conf={self.confidence} tag={self.tag}>"
        )
