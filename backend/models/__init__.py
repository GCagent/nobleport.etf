"""
NoblePort Database Models

All SQLAlchemy models for the NoblePort revenue engine.
Import all models here so Base.metadata.create_all() picks them up.
"""

from backend.models.lead import Lead  # noqa: F401
from backend.models.project import Project  # noqa: F401
from backend.models.estimate import Estimate  # noqa: F401
from backend.models.proposal import (  # noqa: F401
    Proposal,
    ProposalLineItem,
    ProposalMilestone,
    ProposalScopeItem,
)
from backend.models.job import Job  # noqa: F401
from backend.models.payment import Payment  # noqa: F401
from backend.models.change_order import ChangeOrder  # noqa: F401
from backend.models.invoice import Invoice, InvoiceLineItem  # noqa: F401
from backend.models.schedule import ScheduleItem  # noqa: F401
from backend.models.selection import Selection  # noqa: F401
from backend.models.daily_log import DailyLog  # noqa: F401
from backend.models.media import MediaFile, MediaFolder, PhotoAnnotation  # noqa: F401
from backend.models.trust_record import TrustRecord  # noqa: F401
from backend.models.permit import Permit  # noqa: F401
from backend.models.inspection import Inspection  # noqa: F401
from backend.models.maintenance import MaintenanceContract  # noqa: F401
from backend.models.learning_memory import LearningMemory  # noqa: F401
from backend.models.journey_asset import JourneyAsset  # noqa: F401
