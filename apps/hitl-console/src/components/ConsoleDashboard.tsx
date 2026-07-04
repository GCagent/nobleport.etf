import React, { useState } from "react";

export interface HitlTask {
  id: string;
  sessionId: string;
  capabilityTier: "L3" | "L4";
  proposedAction: string;
  disclaimerText: string;
  rawPayload: unknown;
  hash: string;
}

export type HitlDecision = "APPROVED" | "ESCALATED" | "REJECTED";

export interface ConsoleDashboardProps {
  task: HitlTask;
  /** Base URL of the orchestrator API; injected so staging/prod differ by env, not code. */
  apiBase?: string;
  /** Licensed reviewer credential of the operator signed into the console. */
  reviewerId: string;
  onDecision?: (decision: HitlDecision) => void;
}

export const ConsoleDashboard: React.FC<ConsoleDashboardProps> = ({
  task,
  apiBase = "https://api.nobleport.systems",
  reviewerId,
  onDecision,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<HitlDecision | null>(null);

  const handleDecision = async (decision: HitlDecision) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/v1/hitl/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: task.id,
          decision,
          reviewerId,
          timestamp: Date.now(),
          sealedHashChain: task.hash,
        }),
      });
      if (!res.ok) {
        throw new Error(`Gate submission failed: HTTP ${res.status}`);
      }
      setResolved(decision);
      onDecision?.(decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-[#E2E8F0] font-mono p-6 grid grid-cols-12 gap-6">
      {/* Left Column: System Log Stream */}
      <div className="col-span-3 bg-[#111622] border border-[#1E293B] p-4 flex flex-col justify-between">
        <div>
          <h3 className="text-[#38BDF8] text-sm font-bold border-b border-[#1E293B] pb-2 uppercase tracking-wider">
            Session Stream Feed
          </h3>
          <div className="mt-4 text-xs space-y-2 text-[#94A3B8]">
            <p className="text-[#34D399]">Session {task.sessionId} loaded.</p>
            <p>RAG context built via pgvector cluster.</p>
            <p className="text-[#FBBF24]">High-tier framework dependency flagged.</p>
          </div>
        </div>
        <div className="text-[10px] text-[#475569]">
          SECURE OPERATOR VIEW // STEPH.AI
        </div>
      </div>

      {/* Center Column: Interactive Evaluation Canvas */}
      <div className="col-span-6 bg-[#111622] border border-[#1E293B] p-6 flex flex-col justify-between">
        <div>
          <div className="bg-[#1E1B4B] border border-[#3730A3] p-4 rounded-sm text-sm text-[#E0E7FF] mb-4">
            <span className="font-bold text-[#818CF8]">AUTHORITY LAYER FLAG:</span>{" "}
            {task.disclaimerText}
          </div>
          <h2 className="text-xl font-bold mb-4">{task.proposedAction}</h2>
          <div className="bg-[#020617] border border-[#1E293B] p-4 text-xs rounded-sm text-[#34D399]">
            <pre>{JSON.stringify(task.rawPayload, null, 2)}</pre>
          </div>
          {error && (
            <p className="mt-4 text-sm text-[#F87171]" role="alert">
              {error}
            </p>
          )}
          {resolved && (
            <p className="mt-4 text-sm text-[#34D399]">
              Decision recorded: {resolved}
            </p>
          )}
        </div>
        <div className="text-xs text-[#64748B] bg-[#0F172A] p-2 border border-[#1E293B] truncate">
          SHA-256 SEALS: <span className="text-[#EF4444]">{task.hash}</span>
        </div>
      </div>

      {/* Right Column: High-Integrity Decision Portal */}
      <div className="col-span-3 bg-[#111622] border border-[#1E293B] p-4 flex flex-col gap-4">
        <h3 className="text-[#38BDF8] text-sm font-bold border-b border-[#1E293B] pb-2 uppercase tracking-wider">
          Gate Intervention Panel
        </h3>
        <div className="text-xs bg-[#0F172A] p-3 border border-[#1E293B]">
          <span className="block font-bold">REQUIRED LEVEL:</span>
          <span className="text-lg font-bold text-[#FBBF24]">
            {task.capabilityTier} AUTHORITY GATE
          </span>
        </div>
        <button
          disabled={submitting || resolved !== null}
          onClick={() => handleDecision("APPROVED")}
          className="w-full py-3 bg-[#059669] hover:bg-[#10B981] disabled:opacity-50 text-white font-bold transition-colors text-sm rounded-sm"
        >
          AUTHORIZE WORKFLOW EXECUTION
        </button>
        <button
          disabled={submitting || resolved !== null}
          onClick={() => handleDecision("ESCALATED")}
          className="w-full py-3 bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white font-bold transition-colors text-sm rounded-sm"
        >
          ESCALATE TO DUAL SIGNATURE (L4)
        </button>
        <button
          disabled={submitting || resolved !== null}
          onClick={() => handleDecision("REJECTED")}
          className="w-full py-3 bg-[#DC2626] hover:bg-[#EF4444] disabled:opacity-50 text-white font-bold transition-colors text-sm rounded-sm"
        >
          TERMINATE &amp; FORWARD REJECTION
        </button>
      </div>
    </div>
  );
};
