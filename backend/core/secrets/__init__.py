"""
NoblePort Secrets Management

Executable implementation of the Secrets Management Policy v1.0: a
provider-agnostic Secrets Manager abstraction with an encrypted, short-TTL
in-memory cache (AES-256-GCM), secret classification tiers, a documented
secrets inventory, rotation with callbacks, and a fail-fast startup gate.

Public surface:
    SecretsManager, get_secrets_manager, SecretNotFoundError, StartupReport,
    RotationStatus,
    SecretTier, TierPolicy, policy_for, TIER_POLICIES,
    SecretSpec, SecretSchema, SECRETS_INVENTORY, get_spec,
    SecretsProvider, EnvProvider, AwsSecretsManagerProvider,
    GcpSecretManagerProvider, VaultProvider,
    EncryptedSecretCache
"""

from __future__ import annotations

from backend.core.secrets.cache import EncryptedSecretCache
from backend.core.secrets.inventory import (
    SECRETS_INVENTORY,
    SecretSchema,
    SecretSpec,
    get_spec,
)
from backend.core.secrets.factory import build_secrets_manager
from backend.core.secrets.manager import (
    RotationStatus,
    SecretNotFoundError,
    SecretsManager,
    StartupReport,
    get_secrets_manager,
    set_secrets_manager,
)
from backend.core.secrets.providers import (
    AwsSecretsManagerProvider,
    EnvProvider,
    GcpSecretManagerProvider,
    SecretsProvider,
    VaultProvider,
)
from backend.core.secrets.tiers import (
    TIER_POLICIES,
    SecretTier,
    TierPolicy,
    policy_for,
)

__all__ = [
    "SecretsManager",
    "get_secrets_manager",
    "set_secrets_manager",
    "build_secrets_manager",
    "SecretNotFoundError",
    "StartupReport",
    "RotationStatus",
    "SecretTier",
    "TierPolicy",
    "policy_for",
    "TIER_POLICIES",
    "SecretSpec",
    "SecretSchema",
    "SECRETS_INVENTORY",
    "get_spec",
    "SecretsProvider",
    "EnvProvider",
    "AwsSecretsManagerProvider",
    "GcpSecretManagerProvider",
    "VaultProvider",
    "EncryptedSecretCache",
]
