"""
CYBORG.IO — Startup Validation
Fails fast with clear error messages if the environment is not properly configured.
Runs before the server accepts any traffic.
"""
from __future__ import annotations

import os
import sys


# ─── Validation Rules ─────────────────────────────────────────────────────────
# (var_name, required_in_envs, validator_fn, error_message)
PLACEHOLDER_PATTERNS = [
    "xxxx", "your-", "changeme", "replace", "todo", "example", "placeholder",
    "nvapi-xxxxxxxxx", "postgresql://user:password", "redis://localhost",
]


def _is_placeholder(value: str) -> bool:
    v = value.lower()
    return any(p in v for p in PLACEHOLDER_PATTERNS)


def validate_environment(settings) -> list[str]:
    """
    Returns a list of fatal validation errors.
    Empty list = environment is sane enough to start.
    """
    errors: list[str] = []
    env = settings.env.lower()

    # ── NVAPI Key ──────────────────────────────────────────────────────────────
    nvapi = settings.nvapi_key or os.getenv("NVAPI_KEY", "")
    vault_token = settings.vault_token or os.getenv("VAULT_TOKEN", "")

    if not nvapi and not vault_token:
        errors.append(
            "FATAL: No NVAPI key source configured. "
            "Set NVAPI_KEY in .env OR set VAULT_TOKEN so the gateway can pull from Vault."
        )
    elif nvapi and _is_placeholder(nvapi):
        errors.append(
            f"FATAL: NVAPI_KEY looks like a placeholder ('{nvapi[:20]}...'). "
            "Get a real key at https://integrate.api.nvidia.com"
        )

    # ── Vault token in production ──────────────────────────────────────────────
    if env == "production":
        if vault_token and vault_token in ("cyborg-dev-token", "root", "dev"):
            errors.append(
                "FATAL [production]: VAULT_TOKEN is a dev/root token. "
                "Use AppRole or AWS IAM auth in production — never a root token."
            )
        if not vault_token and nvapi:
            # Warn but don't block — env fallback is acceptable in some setups
            print(
                "WARNING [production]: No VAULT_TOKEN set — running with NVAPI_KEY from env. "
                "For production, store the key in Vault KV-v2.",
                file=sys.stderr,
            )

    # ── Vault address sanity ───────────────────────────────────────────────────
    vault_addr = settings.vault_addr
    if env == "production" and vault_addr.startswith("http://"):
        errors.append(
            "FATAL [production]: VAULT_ADDR uses http:// — Vault must be TLS-terminated in production. "
            "Set VAULT_ADDR=https://your-vault-domain:8200"
        )

    # ── ENV value ─────────────────────────────────────────────────────────────
    valid_envs = {"testing", "staging", "production"}
    if env not in valid_envs:
        errors.append(
            f"FATAL: ENV='{settings.env}' is not a valid environment. "
            f"Must be one of: {', '.join(valid_envs)}"
        )

    return errors


def run_startup_validation(settings) -> None:
    """Call this at startup — exits the process if validation fails."""
    errors = validate_environment(settings)

    if errors:
        print("\n" + "=" * 60, file=sys.stderr)
        print("CYBORG.IO STARTUP VALIDATION FAILED", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        for err in errors:
            print(f"  ✗ {err}", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print("Fix .env and restart.\n", file=sys.stderr)
        sys.exit(1)

    print(
        f"[startup] ✓ Environment validated — ENV={settings.env}, "
        f"key_source={'vault' if settings.vault_token else 'env'}",
        file=sys.stderr,
    )
