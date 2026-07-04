"""
Migration Rollback & Backup/Restore Verification  (audit issue #6)
==================================================================

The audit's objection: there was no rollback verification. A migration you cannot
safely reverse is a one-way door in production. This test proves the Alembic
revision is reversible by driving the full roundtrip against a throwaway database:

    base --(upgrade)--> head --(downgrade)--> base --(upgrade)--> head

and asserting the revenue tables appear, disappear, and reappear at each step.
That is real evidence the ``downgrade()`` path actually works, not just that it
was written.

It also verifies the *backup-before-migration* mechanism with a real
backup/restore roundtrip: snapshot the DB file, mutate it, restore the snapshot,
and confirm the mutation is gone. The production equivalent (pg_dump / pg_restore
against Postgres) is documented in docs/verification/verification-framework.md;
this proves the procedure's invariant — a restore returns the exact prior state.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

import backend.config.settings as settings_module

REVENUE_TABLES = {"estimates", "jobs", "payments", "change_orders"}
ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def _alembic_config(db_url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", "backend/migrations")
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def _tables(db_url: str) -> set[str]:
    engine = create_engine(db_url)
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Isolated on-disk sqlite DB; env.py reads settings.database_url at runtime."""
    db_file = tmp_path / "verify_migration.db"
    sync_url = f"sqlite:///{db_file}"
    async_url = f"sqlite+aiosqlite:///{db_file}"
    # env.py pulls settings.database_url when alembic runs in-process.
    monkeypatch.setattr(settings_module.settings, "database_url", async_url)
    return {"file": db_file, "sync_url": sync_url, "async_url": async_url}


def test_migration_roundtrip_is_reversible(temp_db):
    cfg = _alembic_config(temp_db["async_url"])
    sync_url = temp_db["sync_url"]

    # base -> head
    command.upgrade(cfg, "head")
    after_upgrade = _tables(sync_url)
    assert REVENUE_TABLES.issubset(after_upgrade), (
        f"upgrade did not create revenue tables; got {sorted(after_upgrade)}"
    )

    # head -> base (the rollback the audit demanded)
    command.downgrade(cfg, "base")
    after_downgrade = _tables(sync_url)
    assert not (REVENUE_TABLES & after_downgrade), (
        f"downgrade left revenue tables behind: "
        f"{sorted(REVENUE_TABLES & after_downgrade)}"
    )

    # base -> head again (re-applying after rollback must be clean)
    command.upgrade(cfg, "head")
    after_reupgrade = _tables(sync_url)
    assert REVENUE_TABLES.issubset(after_reupgrade), (
        "re-upgrade after rollback failed to recreate revenue tables"
    )


def test_backup_restore_roundtrip_returns_prior_state(temp_db):
    """Backup-before-migration invariant: a restore returns the exact prior DB."""
    cfg = _alembic_config(temp_db["async_url"])
    sync_url = temp_db["sync_url"]
    db_file: Path = temp_db["file"]

    command.upgrade(cfg, "head")

    # Seed a known row so we can detect whether a restore truly reverts state.
    engine = create_engine(sync_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO estimates (id, estimate_number, project_name, "
                "client_name, status, created_at, updated_at) VALUES "
                "('pre-backup', 'EST-RESTORE-1', 'Pre Project', 'Client', "
                "'draft', '2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            )
        )
    engine.dispose()

    # 1) Back up (the step that MUST run before any production migration).
    backup = db_file.with_suffix(".bak")
    shutil.copy2(db_file, backup)

    # 2) Mutate after the backup (simulate a migration/data change going wrong).
    engine = create_engine(sync_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO estimates (id, estimate_number, project_name, "
                "client_name, status, created_at, updated_at) VALUES "
                "('post-backup', 'EST-RESTORE-2', 'Post Project', 'Client', "
                "'draft', '2026-01-02 00:00:00', '2026-01-02 00:00:00')"
            )
        )
    engine.dispose()

    # 3) Restore the backup.
    shutil.copy2(backup, db_file)

    # 4) Prove the post-backup mutation is gone and the prior row survives.
    engine = create_engine(sync_url)
    with engine.begin() as conn:
        ids = {
            r[0]
            for r in conn.execute(text("SELECT id FROM estimates")).fetchall()
        }
    engine.dispose()
    assert "pre-backup" in ids, "restore lost data that existed before the backup"
    assert "post-backup" not in ids, "restore did not revert the post-backup change"
