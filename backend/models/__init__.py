"""
NoblePort Database Models

All SQLAlchemy models for the NoblePort revenue engine and MCP operating model.
Import all models here so Base.metadata.create_all() picks them up.
"""

from backend.models.lead import Lead  # noqa: F401
from backend.models.project import Project  # noqa: F401
from backend.models.estimate import Estimate  # noqa: F401
from backend.models.job import Job  # noqa: F401
from backend.models.payment import Payment  # noqa: F401
from backend.models.change_order import ChangeOrder  # noqa: F401
from backend.models.invoice import Invoice, InvoiceLineItem  # noqa: F401
from backend.models.schedule import ScheduleItem  # noqa: F401
from backend.models.selection import Selection  # noqa: F401
from backend.models.daily_log import DailyLog  # noqa: F401
from backend.models.media import MediaFile, MediaFolder, PhotoAnnotation  # noqa: F401
from backend.models.mcp import (  # noqa: F401
    MCPAgentRegistry,
    MCPToolRegistry,
    NoblePortModuleRegistry,
    MCPCallLog,
    KPISnapshot,
)
from backend.models.operations import (  # noqa: F401
    CustomerProfile,
    ApprovalEvent,
    AuditLogEntry,
    Notification,
    ScopeItem,
    VendorComm,
    PurchaseOrder,
    PunchItem,
    CloseoutDoc,
)
from backend.models.permit_ops import (  # noqa: F401
    PermitPacket,
    AHJRuleset,
    DeficiencyLog,
    DocChecklist,
    ZoningReview,
    ConservationFlag,
    StampRequirement,
    Inspection,
    PermitRejection,
    CertificateOfOccupancy,
)
from backend.models.security_ops import (  # noqa: F401
    PolicyEvent,
    AuthEvent,
    AISecurityLog,
    TreasuryEvent,
    VendorCompliance,
    ComplianceDoc,
    AuditChainAnchor,
    Incident,
    RiskScore,
)
from backend.models.infra_ops import (  # noqa: F401
    AutomationRun,
    WorkerHealth,
    QueueMetric,
    BackupLog,
    Deployment,
    ErrorLog,
    APIHealthCheck,
    DBMetric,
    FileEvent,
)
