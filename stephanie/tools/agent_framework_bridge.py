"""
Agent Framework <-> LangChain bidirectional bridge.

Pattern 1: Wrap Agent Framework agents/tools as LangChain tools.
Pattern 2: Wrap LangChain chains/tools as Agent Framework tools.
Pattern 3: Azure AI Foundry bridge for enterprise-scale deployment.

This module implements all three patterns for the Stephanie.ai hybrid.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Awaitable

from langchain_core.tools import tool, StructuredTool


# ---------------------------------------------------------------------------
# Pattern 1: Agent Framework → LangChain Tool
# ---------------------------------------------------------------------------

def agent_framework_as_langchain_tool(
    name: str,
    description: str,
    agent_factory: Callable[..., Awaitable[dict[str, Any]]],
) -> StructuredTool:
    """
    Wrap an Agent Framework agent as a LangChain tool.

    The agent_factory is an async callable that takes a dict of inputs
    and returns a dict of outputs. This is how Agent Framework agents
    appear inside LangGraph nodes.

    Usage:
        from agent_framework import Agent

        async def my_agent_fn(inputs: dict) -> dict:
            agent = Agent(...)
            return await agent.ainvoke(inputs)

        lc_tool = agent_framework_as_langchain_tool(
            "cert_minter",
            "Mint verifiable credentials via Agent Framework",
            my_agent_fn,
        )
    """

    async def _invoke(query: str) -> str:
        result = await agent_factory({"input": query})
        return json.dumps(result, indent=2, default=str)

    return StructuredTool.from_function(
        coroutine=_invoke,
        name=name,
        description=description,
    )


# ---------------------------------------------------------------------------
# Pattern 2: LangChain Chain → Agent Framework Tool
# ---------------------------------------------------------------------------

def langchain_chain_as_agent_framework_tool(
    name: str,
    description: str,
    chain_factory: Callable[..., Awaitable[dict[str, Any]]],
) -> dict[str, Any]:
    """
    Wrap a LangChain chain as an Agent Framework tool descriptor.

    Returns a dict that can be registered with agent.register_tool()
    in the Agent Framework.

    Usage:
        from langchain.chains import create_retrieval_chain

        async def rag_fn(inputs: dict) -> dict:
            chain = create_retrieval_chain(...)
            return await chain.ainvoke(inputs)

        af_tool = langchain_chain_as_agent_framework_tool(
            "rag_knowledge_lookup",
            "RAG-based knowledge retrieval for AGI learning",
            rag_fn,
        )

        # In Agent Framework:
        # @tool
        # async def rag_knowledge_lookup(query: str) -> str:
        #     return await af_tool["invoke"]({"input": query})
    """

    async def _invoke(inputs: dict[str, Any]) -> dict[str, Any]:
        return await chain_factory(inputs)

    return {
        "name": name,
        "description": description,
        "invoke": _invoke,
        "type": "langchain_chain",
    }


# ---------------------------------------------------------------------------
# Pattern 3: Azure AI Foundry Bridge
# ---------------------------------------------------------------------------

async def create_foundry_agent(
    project_endpoint: str,
    agent_name: str,
    model: str,
    instructions: str,
    tools: list[Any] | None = None,
    trace: bool = True,
) -> Callable[..., Awaitable[dict[str, Any]]]:
    """
    Create a Foundry-hosted Agent Framework agent and return an async callable.

    This agent runs in Azure AI Foundry with full checkpointing,
    session state, and telemetry. Consumed by LangGraph nodes.

    Usage:
        cert_minter = await create_foundry_agent(
            project_endpoint="https://your-foundry-project-endpoint",
            agent_name="CertMintAgent",
            model="gpt-4.1",
            instructions="Run mastery benchmark -> mint verifiable badge.",
        )

        # Use in LangGraph:
        async def cert_mint_node(state):
            result = await cert_minter({"messages": state["messages"]})
            return {"certs": [result["output"]]}
    """
    try:
        from langchain_azure_ai.agents import AgentServiceFactory
        from azure.identity import DefaultAzureCredential

        factory = AgentServiceFactory(
            project_endpoint=project_endpoint,
            credential=DefaultAzureCredential(),
        )

        agent = factory.create_declarative_chat_agent(
            name=agent_name,
            model=model,
            instructions=instructions,
            trace=trace,
        )

        async def _invoke(inputs: dict[str, Any]) -> dict[str, Any]:
            result = await agent.ainvoke(inputs)
            return result

        return _invoke

    except ImportError:
        # Fallback: return a stub when Azure deps aren't available (devnet)
        async def _stub(inputs: dict[str, Any]) -> dict[str, Any]:
            return {
                "output": f"[Foundry stub] {agent_name}: processed {len(inputs.get('messages', []))} messages",
                "agent_name": agent_name,
                "model": model,
            }

        return _stub


# ---------------------------------------------------------------------------
# Convenience: Create Foundry agent as LangChain tool
# ---------------------------------------------------------------------------

async def foundry_agent_as_langchain_tool(
    project_endpoint: str,
    agent_name: str,
    model: str,
    instructions: str,
    tool_description: str,
) -> StructuredTool:
    """
    One-liner: Foundry agent → LangChain tool.

    Combines Pattern 1 + Pattern 3.
    """
    agent_fn = await create_foundry_agent(
        project_endpoint=project_endpoint,
        agent_name=agent_name,
        model=model,
        instructions=instructions,
    )

    return agent_framework_as_langchain_tool(
        name=agent_name.lower().replace(" ", "_"),
        description=tool_description,
        agent_factory=agent_fn,
    )
