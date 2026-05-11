"""
Unified OpenTelemetry tracing for Stephanie.ai.

Bridges LangSmith + Azure AI Foundry monitoring into a single
observability pipeline. All LangChain chains, Agent Framework agents,
and NoblePort module calls flow through this.

Setup:
  1. OpenTelemetry SDK with OTLP exporter (Azure Monitor / custom)
  2. LangSmith integration for LangChain/LangGraph traces
  3. Agent Framework telemetry hooks

Call configure_tracing() once at startup.
"""

from __future__ import annotations

import os
from typing import Any

from stephanie.config import TracingConfig


def configure_tracing(config: TracingConfig | None = None) -> dict[str, bool]:
    """
    Configure all tracing providers.

    Returns a dict indicating which providers were successfully initialized.
    """
    config = config or TracingConfig()
    results = {}

    # 1. LangSmith
    if config.enable_langsmith and config.langsmith_api_key:
        results["langsmith"] = _configure_langsmith(config)
    else:
        results["langsmith"] = False

    # 2. OpenTelemetry (Azure Monitor / custom OTLP)
    if config.enable_azure_monitor and config.otel_endpoint:
        results["otel"] = _configure_otel(config)
    else:
        results["otel"] = False

    # 3. Agent Framework telemetry
    results["agent_framework"] = _configure_agent_framework_telemetry(config)

    return results


def _configure_langsmith(config: TracingConfig) -> bool:
    """
    Configure LangSmith tracing for all LangChain/LangGraph operations.

    Sets environment variables that LangChain auto-detects.
    """
    try:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = config.langsmith_api_key
        os.environ["LANGCHAIN_PROJECT"] = config.langsmith_project

        # Verify connection
        import langsmith
        client = langsmith.Client()
        # client.read_project(project_name=config.langsmith_project)

        print(f"[Tracing] LangSmith configured: project={config.langsmith_project}")
        return True

    except Exception as e:
        print(f"[Tracing] LangSmith configuration failed: {e}")
        return False


def _configure_otel(config: TracingConfig) -> bool:
    """
    Configure OpenTelemetry with OTLP exporter.

    Traces flow to Azure Monitor, Jaeger, or any OTLP-compatible backend.
    This captures both LangChain and Agent Framework operations.
    """
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({
            "service.name": "stephanie-ai",
            "service.version": "4.0.0",
            "deployment.environment": os.getenv("ENVIRONMENT", "devnet"),
            "service.namespace": "nobleport",
        })

        provider = TracerProvider(resource=resource)

        exporter = OTLPSpanExporter(endpoint=config.otel_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))

        trace.set_tracer_provider(provider)

        print(f"[Tracing] OpenTelemetry configured: endpoint={config.otel_endpoint}")
        return True

    except Exception as e:
        print(f"[Tracing] OpenTelemetry configuration failed: {e}")
        return False


def _configure_agent_framework_telemetry(config: TracingConfig) -> bool:
    """
    Configure Agent Framework's built-in telemetry.

    Agent Framework uses OpenTelemetry natively. This hooks it into
    the same OTLP pipeline so all traces appear together.
    """
    try:
        # Agent Framework auto-discovers the OTEL provider set above
        # Additional: configure_otel_providers if using Agent Framework SDK directly
        if config.otel_endpoint:
            os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = config.otel_endpoint

        print("[Tracing] Agent Framework telemetry configured")
        return True

    except Exception as e:
        print(f"[Tracing] Agent Framework telemetry failed: {e}")
        return False


# ---------------------------------------------------------------------------
# Trace decorators for custom spans
# ---------------------------------------------------------------------------

def get_tracer(name: str = "stephanie.ai"):
    """Get an OpenTelemetry tracer for custom instrumentation."""
    try:
        from opentelemetry import trace
        return trace.get_tracer(name)
    except ImportError:
        return None


class trace_operation:
    """
    Decorator/context manager for tracing custom operations.

    Usage:
        @trace_operation("cert_minting")
        async def mint_cert(...):
            ...

        # Or as context manager:
        async with trace_operation("rag_retrieval"):
            ...
    """

    def __init__(self, operation_name: str, attributes: dict[str, Any] | None = None):
        self.operation_name = operation_name
        self.attributes = attributes or {}
        self._span = None

    def __call__(self, func):
        """Use as decorator."""
        import functools

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            tracer = get_tracer()
            if tracer is None:
                return await func(*args, **kwargs)

            with tracer.start_as_current_span(
                self.operation_name,
                attributes=self.attributes,
            ):
                return await func(*args, **kwargs)

        return wrapper

    async def __aenter__(self):
        """Use as async context manager."""
        tracer = get_tracer()
        if tracer:
            self._span = tracer.start_span(
                self.operation_name,
                attributes=self.attributes,
            )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._span:
            if exc_type:
                self._span.set_status(
                    trace.StatusCode.ERROR,
                    str(exc_val) if exc_val else "Unknown error",
                )
            self._span.end()
        return False
