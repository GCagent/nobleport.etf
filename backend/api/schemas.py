"""
NoblePort API Pydantic Schemas

Request/response models for all API endpoints.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Lead Schemas ---

class LeadCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: str = "other"
    estimated_value: Optional[float] = None
    notes: Optional[str] = None
    property_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    estimated_value: Optional[float] = None
    notes: Optional[str] = None
    property_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]
    status: str
    source: str
    estimated_value: Optional[float]
    notes: Optional[str]
    property_address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    assigned_to: Optional[str]
    buildertrend_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Project Schemas ---

class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    project_type: str
    budget: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    parcel_id: Optional[str] = None
    lead_id: Optional[str] = None
    project_manager: Optional[str] = None
    general_contractor: Optional[str] = None
    municipality: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    actual_cost: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    project_manager: Optional[str] = None
    general_contractor: Optional[str] = None
    permit_number: Optional[str] = None
    permit_token_id: Optional[int] = None
    permit_tx_hash: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    project_type: str
    status: str
    budget: Optional[float]
    actual_cost: Optional[float]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    parcel_id: Optional[str]
    lead_id: Optional[str]
    project_manager: Optional[str]
    general_contractor: Optional[str]
    permit_number: Optional[str]
    permit_token_id: Optional[int]
    permit_tx_hash: Optional[str]
    municipality: Optional[str]
    buildertrend_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Schedule Schemas ---

class ScheduleItemCreate(BaseModel):
    project_id: str
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    priority: str = "medium"
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_to: Optional[str] = None
    trade: Optional[str] = None
    depends_on_id: Optional[str] = None
    requires_inspection: bool = False
    inspection_type: Optional[str] = None


class ScheduleItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    percent_complete: Optional[int] = None
    assigned_to: Optional[str] = None
    trade: Optional[str] = None
    inspection_passed: Optional[bool] = None


class ScheduleItemResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    scheduled_start: Optional[datetime]
    scheduled_end: Optional[datetime]
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    percent_complete: int
    assigned_to: Optional[str]
    trade: Optional[str]
    depends_on_id: Optional[str]
    requires_inspection: bool
    inspection_type: Optional[str]
    inspection_passed: Optional[bool]
    buildertrend_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Invoice Schemas ---

class InvoiceLineItemCreate(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    cost_code: Optional[str] = None
    category: Optional[str] = None


class InvoiceCreate(BaseModel):
    project_id: str
    invoice_number: str
    description: Optional[str] = None
    subtotal: float = 0.0
    tax_rate: float = 0.0
    vendor_name: Optional[str] = None
    vendor_id: Optional[str] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    retention_percent: float = 0.0
    draw_number: Optional[int] = None
    percent_complete: Optional[int] = None
    line_items: list[InvoiceLineItemCreate] = []


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    amount_paid: Optional[float] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    paid_date: Optional[datetime] = None
    approved_by: Optional[str] = None
    approval_tx_hash: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: str
    project_id: str
    invoice_number: str
    status: str
    description: Optional[str]
    subtotal: float
    tax_rate: float
    tax_amount: float
    total: float
    amount_paid: float
    balance_due: float
    issue_date: Optional[datetime]
    due_date: Optional[datetime]
    paid_date: Optional[datetime]
    vendor_name: Optional[str]
    vendor_id: Optional[str]
    payment_method: Optional[str]
    payment_reference: Optional[str]
    retention_percent: float
    retention_amount: float
    approved_by: Optional[str]
    approval_tx_hash: Optional[str]
    draw_number: Optional[int]
    percent_complete: Optional[int]
    buildertrend_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Daily Log Schemas ---

class DailyLogCreate(BaseModel):
    project_id: str
    log_date: date
    author: str
    weather: Optional[str] = None
    temperature_high_f: Optional[float] = None
    temperature_low_f: Optional[float] = None
    weather_delay_hours: float = 0.0
    crew_count: int = 0
    subcontractors_on_site: Optional[str] = None
    total_man_hours: float = 0.0
    work_performed: Optional[str] = None
    materials_received: Optional[str] = None
    equipment_used: Optional[str] = None
    safety_incidents: Optional[str] = None
    safety_meeting_held: Optional[bool] = None
    visitors: Optional[str] = None
    inspections_conducted: Optional[str] = None
    notes: Optional[str] = None
    issues: Optional[str] = None
    delays: Optional[str] = None


class DailyLogResponse(BaseModel):
    id: str
    project_id: str
    log_date: date
    author: str
    weather: Optional[str]
    temperature_high_f: Optional[float]
    temperature_low_f: Optional[float]
    weather_delay_hours: float
    crew_count: int
    subcontractors_on_site: Optional[str]
    total_man_hours: float
    work_performed: Optional[str]
    materials_received: Optional[str]
    equipment_used: Optional[str]
    safety_incidents: Optional[str]
    safety_meeting_held: Optional[bool]
    visitors: Optional[str]
    inspections_conducted: Optional[str]
    notes: Optional[str]
    issues: Optional[str]
    delays: Optional[str]
    buildertrend_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Media Schemas ---

class MediaFolderCreate(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    parent_folder_id: Optional[str] = None
    access_level: str = "internal"


class MediaFolderResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str]
    parent_folder_id: Optional[str]
    access_level: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoAnnotationCreate(BaseModel):
    annotation_type: str  # circle, arrow, rectangle, text, freehand
    label: Optional[str] = None
    notes: Optional[str] = None
    x_percent: float
    y_percent: float
    width_percent: Optional[float] = None
    height_percent: Optional[float] = None
    color: str = "#FF0000"
    stroke_width: int = 2
    created_by: str
    is_issue: bool = False


class PhotoAnnotationResponse(BaseModel):
    id: str
    media_file_id: str
    annotation_type: str
    label: Optional[str]
    notes: Optional[str]
    x_percent: float
    y_percent: float
    width_percent: Optional[float]
    height_percent: Optional[float]
    color: str
    stroke_width: int
    created_by: str
    is_issue: bool
    issue_resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaFileResponse(BaseModel):
    id: str
    project_id: str
    folder_id: Optional[str]
    daily_log_id: Optional[str]
    filename: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    media_type: str
    photo_tag: Optional[str]
    caption: Optional[str]
    access_level: str
    uploaded_by: str
    ipfs_hash: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Selection Schemas ---

class SelectionCreate(BaseModel):
    project_id: str
    category: str
    name: str
    description: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    color_finish: Optional[str] = None
    sku: Optional[str] = None
    supplier: Optional[str] = None
    unit_cost: Optional[float] = None
    quantity: Optional[float] = None
    allowance_budget: Optional[float] = None
    room_location: Optional[str] = None
    lead_time_days: Optional[int] = None
    selected_by: Optional[str] = None
    notes: Optional[str] = None
    specification_url: Optional[str] = None


class SelectionUpdate(BaseModel):
    status: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    color_finish: Optional[str] = None
    unit_cost: Optional[float] = None
    quantity: Optional[float] = None
    total_cost: Optional[float] = None
    supplier: Optional[str] = None
    approved_by: Optional[str] = None
    order_date: Optional[datetime] = None
    expected_delivery: Optional[datetime] = None
    notes: Optional[str] = None


class SelectionResponse(BaseModel):
    id: str
    project_id: str
    category: str
    name: str
    description: Optional[str]
    status: str
    manufacturer: Optional[str]
    model_number: Optional[str]
    color_finish: Optional[str]
    sku: Optional[str]
    supplier: Optional[str]
    unit_cost: Optional[float]
    quantity: Optional[float]
    total_cost: Optional[float]
    allowance_budget: Optional[float]
    variance: Optional[float]
    room_location: Optional[str]
    lead_time_days: Optional[int]
    order_date: Optional[datetime]
    expected_delivery: Optional[datetime]
    selected_by: Optional[str]
    approved_by: Optional[str]
    is_change_order: bool
    notes: Optional[str]
    buildertrend_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Estimate Schemas ---

class EstimateCreate(BaseModel):
    lead_id: str
    estimate_number: str = Field(..., max_length=50)
    project_name: str = Field(..., max_length=255)
    base_value: float
    markup_percent: float = 0.0
    deposit_percent: float = 30.0
    scope_description: Optional[str] = None
    job_type: Optional[str] = None
    win_probability: Optional[float] = None
    notes: Optional[str] = None


class EstimateUpdate(BaseModel):
    project_name: Optional[str] = None
    base_value: Optional[float] = None
    markup_percent: Optional[float] = None
    deposit_percent: Optional[float] = None
    status: Optional[str] = None
    scope_description: Optional[str] = None
    job_type: Optional[str] = None
    win_probability: Optional[float] = None
    notes: Optional[str] = None


class EstimateResponse(BaseModel):
    id: str
    lead_id: Optional[str]
    estimate_number: str
    project_name: str
    client_name: str
    client_email: Optional[str]
    client_phone: Optional[str]
    status: str
    base_value: float
    markup_percent: float
    markup_amount: float
    total_value: float
    deposit_percent: float
    deposit_amount: float
    win_probability: Optional[float]
    scope_description: Optional[str]
    job_type: Optional[str]
    valid_until: Optional[datetime]
    sent_at: Optional[datetime]
    approved_at: Optional[datetime]
    costcertified_id: Optional[str]
    hubspot_deal_id: Optional[str]
    notes: Optional[str]
    version: int
    parent_estimate_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Proposal Schemas ---

class ProposalCreate(BaseModel):
    estimate_id: str
    title: Optional[str] = None
    markup_percent: Optional[float] = None
    deposit_percent: Optional[float] = None
    valid_until: Optional[datetime] = None
    terms: Optional[str] = None
    notes: Optional[str] = None


class ProposalLineItemCreate(BaseModel):
    description: str = Field(..., max_length=500)
    quantity: float = 1.0
    labor_cost: float = 0.0
    material_cost: float = 0.0
    unit: Optional[str] = None
    category: Optional[str] = None
    cost_code: Optional[str] = None
    is_allowance: bool = False


class ProposalScopeItemCreate(BaseModel):
    kind: str = Field(..., description="inclusion | exclusion | assumption")
    text: str


class ProposalMilestoneCreate(BaseModel):
    name: str
    trigger: Optional[str] = None
    milestone_type: str = "progress"
    percent: float


class ProposalScheduleCreate(BaseModel):
    milestones: list[ProposalMilestoneCreate]


class ProposalAccept(BaseModel):
    signer_name: str
    signer_email: Optional[str] = None
    signer_ip: Optional[str] = None
    signature_text: Optional[str] = None


class ProposalLineItemResponse(BaseModel):
    id: str
    description: str
    quantity: float
    unit: Optional[str]
    labor_cost: float
    material_cost: float
    total: float
    category: Optional[str]
    cost_code: Optional[str]
    is_allowance: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ProposalScopeItemResponse(BaseModel):
    id: str
    kind: str
    text: str
    sort_order: int

    model_config = {"from_attributes": True}


class ProposalMilestoneResponse(BaseModel):
    id: str
    name: str
    trigger: Optional[str]
    milestone_type: str
    percent: float
    amount: float
    sort_order: int

    model_config = {"from_attributes": True}


class ProposalResponse(BaseModel):
    id: str
    estimate_id: str
    lead_id: Optional[str]
    proposal_number: str
    title: str
    version: int
    client_name: str
    client_email: Optional[str]
    client_phone: Optional[str]
    project_address: Optional[str]
    status: str
    labor_total: float
    material_total: float
    allowance_total: float
    subtotal: float
    markup_percent: float
    markup_amount: float
    total: float
    deposit_percent: float
    deposit_amount: float
    terms: Optional[str]
    notes: Optional[str]
    valid_until: Optional[datetime]
    sent_at: Optional[datetime]
    viewed_at: Optional[datetime]
    accepted_at: Optional[datetime]
    signer_name: Optional[str]
    signed_at: Optional[datetime]
    is_contract_ready: bool = False
    readiness_blockers: list[str] = Field(default_factory=list)
    line_items: list[ProposalLineItemResponse] = Field(default_factory=list)
    scope_items: list[ProposalScopeItemResponse] = Field(default_factory=list)
    milestones: list[ProposalMilestoneResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Job Schemas ---

class JobUpdate(BaseModel):
    status: Optional[str] = None
    crew: Optional[str] = None
    start_date: Optional[date] = None
    estimated_end_date: Optional[date] = None
    total_costs: Optional[float] = None
    notes: Optional[str] = None
    site_address: Optional[str] = None
    site_city: Optional[str] = None
    site_state: Optional[str] = None
    site_zip: Optional[str] = None


class JobResponse(BaseModel):
    id: str
    estimate_id: str
    project_id: Optional[str]
    job_number: str
    status: str
    deposit_required: float
    deposit_paid: float
    deposit_paid_at: Optional[datetime]
    deposit_gate_passed: bool
    contract_value: float
    total_invoiced: float
    total_paid: float
    total_costs: float
    margin: float
    margin_percent: float
    change_order_total: float
    change_order_count: int
    crew: Optional[str]
    start_date: Optional[date]
    estimated_end_date: Optional[date]
    actual_end_date: Optional[date]
    site_address: Optional[str]
    site_city: Optional[str]
    site_state: Optional[str]
    site_zip: Optional[str]
    hubspot_deal_id: Optional[str]
    stripe_customer_id: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Payment Schemas ---

class PaymentResponse(BaseModel):
    id: str
    job_id: str
    change_order_id: Optional[str]
    payment_type: str
    status: str
    amount: float
    currency: str
    processor: str
    stripe_payment_intent_id: Optional[str]
    stripe_checkout_session_id: Optional[str]
    stripe_charge_id: Optional[str]
    paid_at: Optional[datetime]
    failed_at: Optional[datetime]
    description: Optional[str]
    reference_number: Optional[str]
    client_name: Optional[str]
    client_email: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Change Order (AWO) Schemas ---

class ChangeOrderCreate(BaseModel):
    job_id: str
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    reason: str = "client_request"
    labor_cost: float = 0.0
    material_cost: float = 0.0
    markup_percent: float = 0.0
    schedule_impact_days: int = 0
    requires_deposit: bool = False
    deposit_percent: float = 0.0


class ChangeOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    labor_cost: Optional[float] = None
    material_cost: Optional[float] = None
    markup_percent: Optional[float] = None
    schedule_impact_days: Optional[int] = None
    requires_deposit: Optional[bool] = None
    deposit_percent: Optional[float] = None


class ChangeOrderResponse(BaseModel):
    id: str
    job_id: str
    change_order_number: str
    sequence: int
    status: str
    title: str
    description: Optional[str]
    reason: str
    labor_cost: float
    material_cost: float
    markup_percent: float
    markup_amount: float
    total_amount: float
    schedule_impact_days: int
    requires_deposit: bool
    deposit_percent: float
    deposit_amount: float
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    amount_paid: float
    fully_paid: bool
    ai_suggested: bool
    ai_suggestion_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Sync Schemas ---

class SyncRequest(BaseModel):
    direction: str = "pull"
    entities: Optional[list[str]] = None


class SyncStatusResponse(BaseModel):
    status: str
    last_sync: Optional[str]
    sync_mode: str
    sync_interval_minutes: int
    history_count: int


# --- Paginated Response ---

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    pages: int
