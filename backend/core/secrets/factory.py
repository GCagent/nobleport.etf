"""
Provider selection from application settings.

Bridges ``backend.config.settings`` to the provider abstraction so the rest of
the codebase never branches on the active cloud. Section 3 of the policy maps
each environment to an approved provider; this module realizes that choice.
"""

from __future__ import annotations

import logging

from backend.config.settings import SecretsProviderKind, settings
from backend.core.secrets.inventory import SecretSpec
from backend.core.secrets.manager import SecretsManager
from backend.core.secrets.providers import (
    AwsSecretsManagerProvider,
    EnvProvider,
    GcpSecretManagerProvider,
    SecretsProvider,
    VaultProvider,
)

logger = logging.getLogger("nobleport.secrets")


def _settings_fallback(spec: SecretSpec) -> str | None:
    """Resolve a secret from pydantic settings (env + config defaults).

    Maps the inventory env var (e.g. NOBLEPORT_DATABASE_URL) to its settings
    attribute (database_url) so values provided via defaults are visible to the
    local-dev EnvProvider and the startup gate.
    """
    attr = spec.env_var.removeprefix("NOBLEPORT_").lower()
    value = getattr(settings, attr, None)
    return str(value) if value else None


def build_provider() -> SecretsProvider:
    """Construct the provider selected by NOBLEPORT_SECRETS_PROVIDER."""
    kind = settings.secrets_provider
    if kind is SecretsProviderKind.AWS:
        if not settings.aws_region:
            raise ValueError("NOBLEPORT_AWS_REGION is required for the AWS secrets provider")
        return AwsSecretsManagerProvider(
            region=settings.aws_region, prefix=settings.aws_secrets_prefix
        )
    if kind is SecretsProviderKind.GCP:
        if not settings.gcp_project_id:
            raise ValueError("NOBLEPORT_GCP_PROJECT_ID is required for the GCP secrets provider")
        return GcpSecretManagerProvider(project_id=settings.gcp_project_id)
    if kind is SecretsProviderKind.VAULT:
        if not settings.vault_addr:
            raise ValueError("NOBLEPORT_VAULT_ADDR is required for the Vault secrets provider")
        return VaultProvider(
            addr=settings.vault_addr,
            mount_point=settings.vault_mount_point,
            base_path=settings.vault_base_path,
        )
    return EnvProvider(fallback_lookup=_settings_fallback)


def build_secrets_manager() -> SecretsManager:
    """Build a SecretsManager wired to the configured provider."""
    provider = build_provider()
    if isinstance(provider, EnvProvider) and settings.environment.value == "production":
        logger.warning(
            "secrets_provider_env_in_production",
            extra={"hint": "Set NOBLEPORT_SECRETS_PROVIDER to aws/gcp/vault in production."},
        )
    return SecretsManager(provider=provider)
