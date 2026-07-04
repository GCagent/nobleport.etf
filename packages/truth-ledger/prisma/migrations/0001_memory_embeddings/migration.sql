-- Vector ingestion extension setup and memory embeddings table.
-- Requires the pgvector extension on the target PostgreSQL instance.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE memory_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    memory_router_key TEXT NOT NULL,
    truth_tier TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_embeddings_vector
    ON memory_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_memory_router_key
    ON memory_embeddings (memory_router_key);
