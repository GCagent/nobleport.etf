"""
NoblePort Buildertrend API Client

Custom integration bridge for Buildertrend's REST API.
Since NoblePort is not an official Buildertrend integration partner,
this client provides a structured approach to sync data via Buildertrend's
available API endpoints with authentication, rate limiting, and retry logic.

Supports:
- OAuth2 / API Key authentication
- Lead import/export
- Project data sync
- Schedule synchronization
- Invoice and financial data pull
- Daily log retrieval
- Photo/document sync
- Selections tracking
"""

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

import httpx

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class BuildertrendEntity(str, Enum):
    LEADS = "leads"
    PROJECTS = "projects"
    SCHEDULES = "schedules"
    INVOICES = "invoices"
    DAILY_LOGS = "daily_logs"
    PHOTOS = "photos"
    DOCUMENTS = "documents"
    SELECTIONS = "selections"
    CHANGE_ORDERS = "change_orders"
    SUBCONTRACTORS = "subcontractors"


class BuildertrendAuthError(Exception):
    pass


class BuildertrendAPIError(Exception):
    def __init__(self, status_code: int, message: str, response_body: Any = None):
        self.status_code = status_code
        self.message = message
        self.response_body = response_body
        super().__init__(f"Buildertrend API Error {status_code}: {message}")


class BuildertrendRateLimitError(BuildertrendAPIError):
    pass


class RateLimiter:
    """Token bucket rate limiter for API calls."""

    def __init__(self, max_requests_per_minute: int):
        self.max_rpm = max_requests_per_minute
        self.tokens = max_requests_per_minute
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.max_rpm, self.tokens + elapsed * (self.max_rpm / 60.0)
            )
            self.last_refill = now

            if self.tokens < 1:
                wait_time = (1 - self.tokens) / (self.max_rpm / 60.0)
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1


class BuildertrendClient:
    """
    HTTP client for Buildertrend API integration.

    Handles authentication, request construction, rate limiting,
    retry logic, and response parsing for all Buildertrend entity types.
    """

    def __init__(self):
        self.base_url = settings.buildertrend_base_url
        self.api_key = settings.buildertrend_api_key
        self.api_secret = settings.buildertrend_api_secret
        self.username = settings.buildertrend_username
        self.password = settings.buildertrend_password
        self.company_id = settings.buildertrend_company_id
        self.timeout = settings.buildertrend_timeout_seconds
        self.max_retries = settings.buildertrend_max_retries

        self._rate_limiter = RateLimiter(settings.buildertrend_rate_limit_rpm)
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[float] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                headers={"Content-Type": "application/json"},
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def authenticate(self) -> str:
        """
        Authenticate with Buildertrend API.

        Supports two auth flows:
        1. API Key + Secret (preferred for server-to-server)
        2. Username + Password (fallback for user-context operations)
        """
        if self._access_token and self._token_expires_at:
            if time.time() < self._token_expires_at - 60:
                return self._access_token

        client = await self._get_client()

        if self.api_key and self.api_secret:
            auth_payload = {
                "apiKey": self.api_key,
                "apiSecret": self.api_secret,
                "companyId": self.company_id,
            }
        elif self.username and self.password:
            auth_payload = {
                "username": self.username,
                "password": self.password,
                "companyId": self.company_id,
            }
        else:
            raise BuildertrendAuthError(
                "No Buildertrend credentials configured. "
                "Set NOBLEPORT_BUILDERTREND_API_KEY/API_SECRET or USERNAME/PASSWORD."
            )

        try:
            response = await client.post("/auth/token", json=auth_payload)
            if response.status_code != 200:
                raise BuildertrendAuthError(
                    f"Authentication failed: {response.status_code} {response.text}"
                )

            data = response.json()
            self._access_token = data["accessToken"]
            self._token_expires_at = time.time() + data.get("expiresIn", 3600)
            logger.info("Buildertrend authentication successful")
            return self._access_token

        except httpx.HTTPError as e:
            raise BuildertrendAuthError(f"Authentication request failed: {e}")

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute an authenticated API request with rate limiting and retries."""
        await self._rate_limiter.acquire()

        token = await self.authenticate()
        client = await self._get_client()

        headers = {"Authorization": f"Bearer {token}"}
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await client.request(
                    method,
                    endpoint,
                    params=params,
                    json=json_data,
                    headers=headers,
                )

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 30))
                    logger.warning(
                        f"Rate limited. Waiting {retry_after}s (attempt {attempt + 1})"
                    )
                    await asyncio.sleep(retry_after)
                    continue

                if response.status_code == 401:
                    self._access_token = None
                    token = await self.authenticate()
                    headers["Authorization"] = f"Bearer {token}"
                    continue

                if response.status_code >= 400:
                    raise BuildertrendAPIError(
                        status_code=response.status_code,
                        message=response.text,
                        response_body=response.json() if response.text else None,
                    )

                return response.json()

            except httpx.HTTPError as e:
                last_error = e
                if attempt < self.max_retries:
                    wait = 2 ** (attempt + 1)
                    logger.warning(
                        f"Request failed, retrying in {wait}s: {e}"
                    )
                    await asyncio.sleep(wait)

        raise BuildertrendAPIError(
            status_code=0,
            message=f"All {self.max_retries + 1} attempts failed: {last_error}",
        )

    # --- Lead Operations ---

    async def get_leads(
        self,
        since: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        params = {"page": page, "pageSize": page_size}
        if since:
            params["modifiedSince"] = since.isoformat()
        return await self._request("GET", "/leads", params=params)

    async def get_lead(self, lead_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/leads/{lead_id}")

    async def create_lead(self, lead_data: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/leads", json_data=lead_data)

    async def update_lead(
        self, lead_id: str, lead_data: dict[str, Any]
    ) -> dict[str, Any]:
        return await self._request("PUT", f"/leads/{lead_id}", json_data=lead_data)

    # --- Project Operations ---

    async def get_projects(
        self,
        status: str | None = None,
        since: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        params = {"page": page, "pageSize": page_size}
        if status:
            params["status"] = status
        if since:
            params["modifiedSince"] = since.isoformat()
        return await self._request("GET", "/projects", params=params)

    async def get_project(self, project_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/projects/{project_id}")

    # --- Schedule Operations ---

    async def get_schedule(
        self, project_id: str, since: datetime | None = None
    ) -> dict[str, Any]:
        params = {}
        if since:
            params["modifiedSince"] = since.isoformat()
        return await self._request(
            "GET", f"/projects/{project_id}/schedule", params=params
        )

    async def update_schedule_item(
        self, project_id: str, item_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        return await self._request(
            "PUT", f"/projects/{project_id}/schedule/{item_id}", json_data=data
        )

    # --- Invoice Operations ---

    async def get_invoices(
        self,
        project_id: str | None = None,
        since: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        params = {"page": page, "pageSize": page_size}
        if since:
            params["modifiedSince"] = since.isoformat()

        if project_id:
            endpoint = f"/projects/{project_id}/invoices"
        else:
            endpoint = "/invoices"
        return await self._request("GET", endpoint, params=params)

    async def get_invoice(
        self, project_id: str, invoice_id: str
    ) -> dict[str, Any]:
        return await self._request(
            "GET", f"/projects/{project_id}/invoices/{invoice_id}"
        )

    # --- Daily Log Operations ---

    async def get_daily_logs(
        self, project_id: str, since: datetime | None = None
    ) -> dict[str, Any]:
        params = {}
        if since:
            params["modifiedSince"] = since.isoformat()
        return await self._request(
            "GET", f"/projects/{project_id}/dailylogs", params=params
        )

    async def create_daily_log(
        self, project_id: str, log_data: dict[str, Any]
    ) -> dict[str, Any]:
        return await self._request(
            "POST", f"/projects/{project_id}/dailylogs", json_data=log_data
        )

    # --- Photo/Document Operations ---

    async def get_photos(
        self, project_id: str, folder_id: str | None = None
    ) -> dict[str, Any]:
        params = {}
        if folder_id:
            params["folderId"] = folder_id
        return await self._request(
            "GET", f"/projects/{project_id}/photos", params=params
        )

    async def get_documents(
        self, project_id: str, folder_id: str | None = None
    ) -> dict[str, Any]:
        params = {}
        if folder_id:
            params["folderId"] = folder_id
        return await self._request(
            "GET", f"/projects/{project_id}/documents", params=params
        )

    # --- Selection Operations ---

    async def get_selections(
        self, project_id: str, since: datetime | None = None
    ) -> dict[str, Any]:
        params = {}
        if since:
            params["modifiedSince"] = since.isoformat()
        return await self._request(
            "GET", f"/projects/{project_id}/selections", params=params
        )

    # --- Utility ---

    @staticmethod
    def compute_sync_hash(data: dict[str, Any]) -> str:
        """Compute a hash of entity data to detect changes."""
        canonical = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode()).hexdigest()

    async def test_connection(self) -> dict[str, Any]:
        """Test API connectivity and authentication."""
        try:
            await self.authenticate()
            return {
                "status": "connected",
                "company_id": self.company_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except (BuildertrendAuthError, BuildertrendAPIError) as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
