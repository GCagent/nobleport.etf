"""
Approved Secrets Providers

Implements section 3 of the Secrets Management Policy v1.0. A provider knows how
to fetch a secret's current value by inventory name. The SecretsManager treats
all providers through this single interface so services stay provider-agnostic.

    AWS Secrets Manager  - recommended for AWS deployments (IAM role auth)
    GCP Secret Manager   - recommended for GCP deployments (service account)
    HashiCorp Vault      - self-hosted / multi-cloud (K8s auth, AppRole fallback)
    Environment variables - LOCAL DEVELOPMENT ONLY, non-production secrets

Cloud-provider SDKs (boto3, google-cloud-secret-manager, hvac) are imported
lazily so the abstraction has no hard dependency on any single cloud. A provider
that cannot import its SDK raises a clear, actionable error.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Callable

from backend.core.secrets.inventory import SecretSpec


class SecretsProvider(ABC):
    """Provider-agnostic interface for fetching a secret by inventory spec."""

    #: Stable identifier used in health output and audit logs.
    name: str = "abstract"

    @abstractmethod
    def fetch(self, spec: SecretSpec) -> str | None:
        """Return the current secret value, or ``None`` if not found."""
        raise NotImplementedError


class EnvProvider(SecretsProvider):
    """Resolve secrets from environment variables.

    Permitted for local development only (section 3.4). Production deployments
    must use a managed provider.
    """

    name = "env"

    def __init__(self, fallback_lookup: Callable[[SecretSpec], str | None] | None = None) -> None:
        # Optional resolver (e.g. pydantic settings) consulted when the raw
        # environment variable is unset, so values supplied via config defaults
        # are still visible to the startup gate.
        self._fallback_lookup = fallback_lookup

    def fetch(self, spec: SecretSpec) -> str | None:
        value = os.environ.get(spec.env_var)
        if value:
            return value
        if self._fallback_lookup is not None:
            fallback = self._fallback_lookup(spec)
            if fallback:
                return fallback
        return None


class AwsSecretsManagerProvider(SecretsProvider):
    """AWS Secrets Manager via IAM role identity (no long-lived access keys).

    Secrets resolve under an environment-scoped prefix, e.g.
    ``nobleport/prod/<name>`` (section 3.1).
    """

    name = "aws_secrets_manager"

    def __init__(self, region: str, prefix: str = "nobleport/prod/") -> None:
        self.region = region
        self.prefix = prefix
        self._client = None

    def _ensure_client(self):
        if self._client is None:
            try:
                import boto3  # noqa: WPS433 - lazy import keeps the dep optional
            except ImportError as exc:
                raise RuntimeError(
                    "AwsSecretsManagerProvider requires boto3. Install it in the "
                    "deployment image to use AWS Secrets Manager."
                ) from exc
            self._client = boto3.client("secretsmanager", region_name=self.region)
        return self._client

    def fetch(self, spec: SecretSpec) -> str | None:
        client = self._ensure_client()
        secret_id = f"{self.prefix}{spec.name}"
        try:
            resp = client.get_secret_value(SecretId=secret_id)
        except client.exceptions.ResourceNotFoundException:
            return None
        return resp.get("SecretString")


class GcpSecretManagerProvider(SecretsProvider):
    """GCP Secret Manager via service account with secretAccessor (section 3.2)."""

    name = "gcp_secret_manager"

    def __init__(self, project_id: str, version: str = "latest") -> None:
        self.project_id = project_id
        self.version = version
        self._client = None

    def _ensure_client(self):
        if self._client is None:
            try:
                from google.cloud import secretmanager  # noqa: WPS433
            except ImportError as exc:
                raise RuntimeError(
                    "GcpSecretManagerProvider requires google-cloud-secret-manager. "
                    "Install it in the deployment image to use GCP Secret Manager."
                ) from exc
            self._client = secretmanager.SecretManagerServiceClient()
        return self._client

    def fetch(self, spec: SecretSpec) -> str | None:
        from google.api_core.exceptions import NotFound  # noqa: WPS433

        client = self._ensure_client()
        # Inventory names use hyphens; Secret Manager IDs allow them.
        path = f"projects/{self.project_id}/secrets/{spec.name}/versions/{self.version}"
        try:
            resp = client.access_secret_version(name=path)
        except NotFound:
            return None
        return resp.payload.data.decode("utf-8")


class VaultProvider(SecretsProvider):
    """HashiCorp Vault, approved for self-hosted / multi-cloud (section 3.3).

    Production authentication must use short-lived tokens via trusted identity:
    Kubernetes auth (primary) or AppRole (fallback). Static ``VAULT_TOKEN``
    exports are prohibited in production.
    """

    name = "vault"

    def __init__(self, addr: str, mount_point: str = "secret", base_path: str = "nobleport/prod") -> None:
        self.addr = addr
        self.mount_point = mount_point
        self.base_path = base_path
        self._client = None

    def _ensure_client(self):
        if self._client is None:
            try:
                import hvac  # noqa: WPS433
            except ImportError as exc:
                raise RuntimeError(
                    "VaultProvider requires hvac. Install it in the deployment "
                    "image to use HashiCorp Vault."
                ) from exc
            self._client = hvac.Client(url=self.addr)
        return self._client

    def fetch(self, spec: SecretSpec) -> str | None:
        client = self._ensure_client()
        path = f"{self.base_path}/{spec.name}"
        resp = client.secrets.kv.v2.read_secret_version(path=path, mount_point=self.mount_point)
        data = resp["data"]["data"]
        # Convention: single-value secrets store under the "value" key.
        return data.get("value") or next(iter(data.values()), None)
