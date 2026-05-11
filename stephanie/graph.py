"""
Stephanie.ai LangGraph Orchestrator

Primary integration pattern: LangGraph as orchestrator + Agent Framework
agents as nodes. This gives us LangGraph's flexible stateful graphs +
Agent Framework's durable sessions, checkpointing, and telemetry.

Graph topology:
    router → {agi_learner, cert_minter, avatar_voice, compliance, manus} → aggregator → END

Each node can be:
  - A pure LangChain chain (fast, local)
  - A Foundry-hosted Agent Framework agent (durable, checkpointed)
  - A hybrid (LangChain chain that calls Agent Framework tools)
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, Literal

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from stephanie.config import StephanieConfig


# ---------------------------------------------------------------------------
# Graph State
# ---------------------------------------------------------------------------

class StephanieState(dict):
    """
    Shared state flowing through the Stephanie graph.

    Fields:
        messages:       Conversation history (append-only).
        task_type:      Routed task category.
        certs:          Accumulated credential wallet.
        learning_state: AGI learning progress.
        avatar_output:  Avatar/voice rendering data.
        audit_trail:    Immutable log for compliance.
        metadata:       Arbitrary k/v for inter-node data passing.
    """

    messages: Annotated[list[BaseMessage], operator.add]
    task_type: str
    certs: list[dict[str, Any]]
    learning_state: dict[str, Any]
    avatar_output: dict[str, Any]
    audit_trail: list[dict[str, Any]]
    metadata: dict[str, Any]


def _default_state() -> dict:
    return {
        "messages": [],
        "task_type": "",
        "certs": [],
        "learning_state": {},
        "avatar_output": {},
        "audit_trail": [],
        "metadata": {},
    }


# ---------------------------------------------------------------------------
# Router Node
# ---------------------------------------------------------------------------

def router_node(state: dict) -> dict:
    """
    Classify the incoming request and set task_type.

    Routes to the appropriate specialist agent based on intent.
    In production, this uses an LLM classifier. Here we use keyword matching
    as the baseline, upgradeable to a fine-tuned classifier.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"task_type": "unknown"}

    last_msg = messages[-1].content.lower() if messages else ""

    routing_rules = [
        (["learn", "study", "knowledge", "agi", "improve", "training"], "agi_learning"),
        (["cert", "degree", "diploma", "badge", "credential", "mint"], "cert_minting"),
        (["avatar", "voice", "speak", "render", "face", "emotion"], "avatar_voice"),
        (["compliance", "kyc", "aml", "regulatory", "audit"], "compliance"),
        (["delegate", "manus", "execute", "automate", "task"], "manus_delegation"),
        (["portfolio", "nav", "holdings", "performance"], "portfolio_analysis"),
    ]

    for keywords, task_type in routing_rules:
        if any(kw in last_msg for kw in keywords):
            return {"task_type": task_type}

    return {"task_type": "general"}


# ---------------------------------------------------------------------------
# Agent Nodes (stubs — implementations in agents/)
# ---------------------------------------------------------------------------

async def agi_learner_node(state: dict) -> dict:
    """
    AGI learning loop via RAG + Agent Framework durable session.

    Uses LangChain retrieval chain for knowledge lookup,
    Agent Framework for checkpointed learning progress.
    """
    from stephanie.agents.agi_learner import run_learning_cycle

    result = await run_learning_cycle(
        messages=state.get("messages", []),
        learning_state=state.get("learning_state", {}),
    )

    return {
        "messages": [AIMessage(content=result["response"])],
        "learning_state": result["updated_state"],
        "audit_trail": [result["audit_entry"]],
    }


async def cert_minter_node(state: dict) -> dict:
    """
    Credential minting via Foundry-hosted Agent Framework agent.

    Runs mastery benchmark → generates proof → mints verifiable badge/diploma.
    """
    from stephanie.agents.cert_minter import mint_credential

    result = await mint_credential(
        messages=state.get("messages", []),
        learning_state=state.get("learning_state", {}),
    )

    return {
        "messages": [AIMessage(content=result["response"])],
        "certs": [result["credential"]],
        "audit_trail": [result["audit_entry"]],
    }


async def avatar_voice_node(state: dict) -> dict:
    """
    Avatar + voice generation.

    LangChain handles prompt chaining for emotional/prosody generation.
    Agent Framework ensures low-latency, interruptible execution.
    """
    from stephanie.agents.avatar_voice import generate_avatar_output

    result = await generate_avatar_output(
        messages=state.get("messages", []),
        metadata=state.get("metadata", {}),
    )

    return {
        "messages": [AIMessage(content=result["response"])],
        "avatar_output": result["avatar_data"],
        "audit_trail": [result["audit_entry"]],
    }


async def compliance_node(state: dict) -> dict:
    """
    Compliance review using the existing NoblePort compliance engine.

    Wraps the compliance.nobleport.eth module as a LangChain tool,
    runs regulatory checks, outputs structured audit data.
    """
    from stephanie.tools.nobleport_modules import call_nobleport_module

    result = await call_nobleport_module(
        module_key="COMPLIANCE_ENGINE",
        action="review",
        context={
            "messages": [m.content for m in state.get("messages", [])],
        },
    )

    return {
        "messages": [AIMessage(content=result.get("summary", "Compliance review complete."))],
        "audit_trail": [
            {
                "type": "compliance_review",
                "result": result,
                "module": "compliance.nobleport.eth",
            }
        ],
    }


async def manus_delegation_node(state: dict) -> dict:
    """
    Delegate complex tasks to Manus API.

    Both LangChain and Agent Framework register Manus as a tool.
    This node handles the delegation handoff.
    """
    from stephanie.tools.nobleport_modules import call_manus

    messages = state.get("messages", [])
    last_msg = messages[-1].content if messages else ""

    result = await call_manus(task_description=last_msg)

    return {
        "messages": [AIMessage(content=result.get("response", "Task delegated to Manus."))],
        "audit_trail": [
            {
                "type": "manus_delegation",
                "task": last_msg,
                "result": result,
            }
        ],
    }


async def general_node(state: dict) -> dict:
    """Fallback: general-purpose response via default LLM."""
    messages = state.get("messages", [])
    last_msg = messages[-1].content if messages else "Hello"

    return {
        "messages": [
            AIMessage(
                content=f"[Stephanie.ai] Processing general request: {last_msg[:100]}..."
            )
        ],
    }


async def aggregator_node(state: dict) -> dict:
    """
    Terminal aggregator. Collects all outputs, validates audit trail,
    prepares the final response. No-op in simple flows.
    """
    return {}


# ---------------------------------------------------------------------------
# Conditional Edges
# ---------------------------------------------------------------------------

def route_by_task_type(state: dict) -> str:
    """Direct the graph to the correct agent node based on task_type."""
    task_type = state.get("task_type", "general")

    route_map = {
        "agi_learning": "agi_learner",
        "cert_minting": "cert_minter",
        "avatar_voice": "avatar_voice",
        "compliance": "compliance",
        "manus_delegation": "manus_delegate",
        "portfolio_analysis": "general",
    }

    return route_map.get(task_type, "general")


# ---------------------------------------------------------------------------
# Graph Builder
# ---------------------------------------------------------------------------

class StephanieGraph:
    """
    Build and compile the Stephanie.ai LangGraph.

    Usage:
        config = StephanieConfig.from_env()
        graph = StephanieGraph(config)
        compiled = graph.compile()
        result = await compiled.ainvoke({"messages": [HumanMessage(content="...")]})
    """

    def __init__(self, config: StephanieConfig):
        self.config = config
        self._graph: StateGraph | None = None

    def build(self) -> StateGraph:
        """Construct the graph topology."""
        builder = StateGraph(dict)

        # Nodes
        builder.add_node("router", router_node)
        builder.add_node("agi_learner", agi_learner_node)
        builder.add_node("cert_minter", cert_minter_node)
        builder.add_node("avatar_voice", avatar_voice_node)
        builder.add_node("compliance", compliance_node)
        builder.add_node("manus_delegate", manus_delegation_node)
        builder.add_node("general", general_node)
        builder.add_node("aggregator", aggregator_node)

        # Entry
        builder.set_entry_point("router")

        # Conditional routing from router → agent nodes
        builder.add_conditional_edges(
            "router",
            route_by_task_type,
            {
                "agi_learner": "agi_learner",
                "cert_minter": "cert_minter",
                "avatar_voice": "avatar_voice",
                "compliance": "compliance",
                "manus_delegate": "manus_delegate",
                "general": "general",
            },
        )

        # All agent nodes → aggregator → END
        for node in ["agi_learner", "cert_minter", "avatar_voice",
                      "compliance", "manus_delegate", "general"]:
            builder.add_edge(node, "aggregator")

        builder.add_edge("aggregator", END)

        self._graph = builder
        return builder

    def compile(self, checkpointer: bool = True):
        """
        Compile the graph with optional persistent checkpointing.

        Checkpointer enables durable state across sessions —
        critical for AGI learning and cert wallet persistence.
        """
        if self._graph is None:
            self.build()

        memory = MemorySaver() if checkpointer else None
        return self._graph.compile(checkpointer=memory)
