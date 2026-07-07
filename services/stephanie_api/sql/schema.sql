-- NoblePort ETF — Stephanie API Schema
-- Run: psql -U nobleport -d nobleport < schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Leads ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT,
    property_address TEXT NOT NULL,
    project_type    TEXT NOT NULL,
    description     TEXT,
    estimated_budget NUMERIC(12,2),
    status          TEXT NOT NULL DEFAULT 'new',
    proposal_id     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

-- ─── Proposals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id         UUID NOT NULL REFERENCES leads(id),
    estimated_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    deposit_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    deposit_pct     NUMERIC(4,3) NOT NULL DEFAULT 0.30,
    deposit_paid    BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL DEFAULT 'draft',
    stripe_session_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- ─── Deposits ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposits (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id     UUID NOT NULL REFERENCES proposals(id),
    amount          NUMERIC(12,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    stripe_payment_intent TEXT,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_proposal ON deposits(proposal_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- ─── Webhook Events (audit) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
    id              SERIAL PRIMARY KEY,
    event_type      TEXT NOT NULL,
    proposal_id     UUID,
    payload         JSONB,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_proposal ON webhook_events(proposal_id);

-- ─── Updated-at trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_leads_updated_at') THEN
        CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proposals_updated_at') THEN
        CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON proposals
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deposits_updated_at') THEN
        CREATE TRIGGER trg_deposits_updated_at BEFORE UPDATE ON deposits
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END$$;

-- ─── Voice Sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_sessions (
    id              UUID PRIMARY KEY,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_started ON voice_sessions(started_at DESC);

-- ─── Transcripts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transcripts (
    id              SERIAL PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES voice_sessions(id),
    speaker         TEXT NOT NULL,
    text            TEXT NOT NULL,
    confidence      REAL NOT NULL DEFAULT 1.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_created ON transcripts(created_at DESC);

-- ─── Audit Hash Chain ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_chain (
    id              UUID PRIMARY KEY,
    prev_hash       TEXT NOT NULL,
    hash            TEXT NOT NULL,
    entry           JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_chain_created ON audit_chain(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_chain_session ON audit_chain((entry->>'sessionId'));

-- ─── Payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY,
    user_id         TEXT NOT NULL,
    method          TEXT NOT NULL,
    amount_usd      NUMERIC(12,2) NOT NULL,
    tokens_credited INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    external_id     TEXT,
    tx_hash         TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);
CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_id);

-- ─── Token Balances (NBPT) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_balances (
    user_id         TEXT PRIMARY KEY,
    balance         INTEGER NOT NULL DEFAULT 0,
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Token Transactions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_transactions (
    id              UUID PRIMARY KEY,
    user_id         TEXT NOT NULL,
    type            TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    reason          TEXT NOT NULL,
    payment_id      UUID REFERENCES payments(id),
    balance_after   INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_tx_user ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_payment ON token_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_created ON token_transactions(created_at DESC);

