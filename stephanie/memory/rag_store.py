"""
RAG Vector Store for Stephanie's long-term memory.

Supports multiple backends:
  - ChromaDB (local, default for devnet)
  - Pinecone (managed, production)
  - Qdrant (self-hosted option)

This is the memory backbone for the AGI learning agent.
Knowledge is ingested, embedded, and retrieved for learning cycles.
"""

from __future__ import annotations

from typing import Any

from stephanie.config import VectorStoreConfig


# ---------------------------------------------------------------------------
# Store Interface
# ---------------------------------------------------------------------------

class RAGStore:
    """
    Unified RAG store interface.

    Wraps LangChain's vectorstore abstractions with Stephanie-specific
    ingestion and retrieval patterns.
    """

    def __init__(self, config: VectorStoreConfig | None = None):
        self.config = config or VectorStoreConfig()
        self._store = None
        self._embeddings = None

    async def initialize(self) -> None:
        """Initialize the embedding model and vector store."""
        self._embeddings = self._create_embeddings()
        self._store = self._create_store()

    def _create_embeddings(self):
        """Create the embedding model based on configuration."""
        try:
            from langchain_openai import OpenAIEmbeddings
            return OpenAIEmbeddings(model=self.config.embedding_model)
        except ImportError:
            return None

    def _create_store(self):
        """Create the vector store backend."""
        if self._embeddings is None:
            return None

        if self.config.provider == "chroma":
            return self._create_chroma()
        elif self.config.provider == "pinecone":
            return self._create_pinecone()
        return None

    def _create_chroma(self):
        """Create a ChromaDB-backed vector store."""
        try:
            from langchain_chroma import Chroma
            return Chroma(
                collection_name=self.config.collection_name,
                embedding_function=self._embeddings,
                persist_directory=self.config.persist_directory,
            )
        except ImportError:
            return None

    def _create_pinecone(self):
        """Create a Pinecone-backed vector store."""
        try:
            from langchain_pinecone import PineconeVectorStore
            return PineconeVectorStore(
                index_name=self.config.pinecone_index,
                embedding=self._embeddings,
            )
        except ImportError:
            return None

    async def ingest(self, documents: list[dict[str, Any]]) -> int:
        """
        Ingest documents into the vector store.

        Each document should have:
            content: str     — the text to embed
            metadata: dict   — arbitrary metadata (source, topic, timestamp)

        Returns the number of documents ingested.
        """
        if self._store is None:
            return 0

        from langchain_core.documents import Document

        docs = [
            Document(
                page_content=d["content"],
                metadata=d.get("metadata", {}),
            )
            for d in documents
        ]

        await self._store.aadd_documents(docs)
        return len(docs)

    async def retrieve(
        self,
        query: str,
        k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Retrieve relevant documents for a query.

        Returns a list of dicts with content, metadata, and relevance score.
        """
        if self._store is None:
            # Stub response when store isn't configured
            return [
                {
                    "content": f"[Memory stub] Relevant knowledge for: {query[:100]}",
                    "metadata": {"source": "stub"},
                    "score": 0.9,
                }
            ]

        results = await self._store.asimilarity_search_with_score(
            query,
            k=k,
            filter=filter_metadata,
        )

        return [
            {
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": score,
            }
            for doc, score in results
        ]

    async def delete_by_metadata(self, filter_metadata: dict[str, Any]) -> None:
        """Delete documents matching metadata filter."""
        if self._store is None:
            return
        # Implementation depends on backend
        pass


# ---------------------------------------------------------------------------
# Module-level convenience functions
# ---------------------------------------------------------------------------

_default_store: RAGStore | None = None


async def get_store(config: VectorStoreConfig | None = None) -> RAGStore:
    """Get or create the default RAG store."""
    global _default_store
    if _default_store is None:
        _default_store = RAGStore(config)
        await _default_store.initialize()
    return _default_store


async def retrieve(query: str, k: int = 5) -> list[dict[str, Any]]:
    """Convenience: retrieve from the default store."""
    store = await get_store()
    return await store.retrieve(query, k=k)


async def ingest(documents: list[dict[str, Any]]) -> int:
    """Convenience: ingest into the default store."""
    store = await get_store()
    return await store.ingest(documents)
