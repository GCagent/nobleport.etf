"""
NoblePort Daily Log Model

Standardized daily activity logging for construction projects.
Captures weather, crew, progress, safety notes, and visitor records.
"""

from enum import Enum as PyEnum

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class WeatherCondition(str, PyEnum):
    CLEAR = "clear"
    PARTLY_CLOUDY = "partly_cloudy"
    OVERCAST = "overcast"
    RAIN = "rain"
    HEAVY_RAIN = "heavy_rain"
    SNOW = "snow"
    ICE = "ice"
    FOG = "fog"
    WINDY = "windy"
    EXTREME_HEAT = "extreme_heat"
    EXTREME_COLD = "extreme_cold"


class DailyLog(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "daily_logs"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )

    # Date & Author
    log_date: Mapped[str] = mapped_column(Date, nullable=False, index=True)
    author: Mapped[str] = mapped_column(String(255), nullable=False)

    # Weather
    weather: Mapped[WeatherCondition | None] = mapped_column(
        Enum(WeatherCondition), nullable=True
    )
    temperature_high_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_low_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    weather_delay_hours: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )

    # Crew & Labor
    crew_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    subcontractors_on_site: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_man_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Progress
    work_performed: Mapped[str | None] = mapped_column(Text, nullable=True)
    materials_received: Mapped[str | None] = mapped_column(Text, nullable=True)
    equipment_used: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Safety & Compliance
    safety_incidents: Mapped[str | None] = mapped_column(Text, nullable=True)
    safety_meeting_held: Mapped[bool | None] = mapped_column(nullable=True)
    osha_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Visitors & Inspections
    visitors: Mapped[str | None] = mapped_column(Text, nullable=True)
    inspections_conducted: Mapped[str | None] = mapped_column(Text, nullable=True)

    # General Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    issues: Mapped[str | None] = mapped_column(Text, nullable=True)
    delays: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<DailyLog {self.log_date} project={self.project_id}>"
