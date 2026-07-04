"""
Object Storage Verification  (audit issue #7)
=============================================

The audit's objection: if the schema carries a ``Photo`` / ``s3Key`` and the
platform claims file handling, deployment verification must prove upload,
retrieval, signed-URL generation, and deletion — not assume them.

The honest finding for THIS build: there is no object-storage backend. There is
no ``Photo`` model, no S3/bucket configuration, no presigned-URL code, and no
storage SDK in requirements. Fabricating an upload/retrieve/sign/delete proof
would be exactly the kind of false evidence the audit warns against.

So this test enforces the *honest contract* instead: it verifies that no object
storage is wired in, and therefore that nothing in the platform may advertise
object storage as a LIVE capability. If/when a storage backend is added, this
test will start failing — a deliberate tripwire that forces real
upload/retrieve/sign/delete evidence to be written before the capability ships.

The verification framework records this artifact as NOT_APPLICABLE (non-gating),
so it neither blocks RC1 nor lets a phantom capability pass as proven.
"""

from __future__ import annotations

import importlib

from backend.config.operational_truth import OPERATIONAL_TRUTH, DeploymentStatus


def _storage_backend_present() -> bool:
    """True if any object-storage backend appears to be configured/implemented."""
    # 1) Storage SDK installed?
    for mod in ("boto3", "minio", "google.cloud.storage", "azure.storage.blob"):
        try:
            importlib.import_module(mod)
            return True
        except ImportError:
            continue

    # 2) Storage config on settings?
    from backend.config.settings import settings

    storage_attrs = (
        "s3_bucket",
        "aws_s3_bucket",
        "storage_bucket",
        "object_storage_url",
        "minio_endpoint",
    )
    if any(getattr(settings, attr, None) for attr in storage_attrs):
        return True

    # 3) A Photo / asset-with-key model?
    try:
        import backend.models as models  # noqa: F401

        for name in dir(models):
            obj = getattr(models, name)
            if hasattr(obj, "__table__"):
                cols = {c.name for c in obj.__table__.columns}
                if {"s3_key"} & cols or {"s3key"} & cols:
                    return True
    except Exception:
        pass

    return False


def test_object_storage_state_is_honest():
    backend_present = _storage_backend_present()

    if not backend_present:
        # No backend -> nothing may claim object storage as a LIVE feature.
        live_storage_claims = [
            key
            for key, entry in OPERATIONAL_TRUTH.items()
            if entry["status"] == DeploymentStatus.LIVE
            and "storage" in entry["description"].lower()
        ]
        assert not live_storage_claims, (
            "No object-storage backend exists, yet these features claim LIVE "
            f"storage capability: {live_storage_claims}. Either implement and "
            "prove storage, or downgrade the claim."
        )
    else:
        # A backend exists: this honest-state test no longer applies. The
        # framework must now require a real upload/retrieve/sign/delete proof.
        raise AssertionError(
            "An object-storage backend is now present. Replace this honesty "
            "tripwire with a real upload/retrieve/signed-URL/delete verification "
            "and mark the 'object_storage' artifact as GATING."
        )
