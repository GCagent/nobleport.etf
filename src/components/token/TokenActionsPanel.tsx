'use client';

/**
 * Example NBPT token panel: issuance plus the Stephanie.ai voice flow.
 *
 * Voice commands only PREPARE an action (Nemoclaw §10.2 — model output never
 * reaches a signer directly); the operator must press Confirm, and the wallet
 * signature is the final human gate.
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useContract } from '@/context/ContractContext';
import type { PreparedTokenAction } from '@/hooks/useERC1400Actions';

export default function TokenActionsPanel() {
  const { address, isConnected } = useAccount();
  const {
    balance,
    isLoadingBalance,
    kycVerified,
    accredited,
    liveOfferingCleared,
    issue,
    isIssuePending,
    prepareVoiceCommand,
  } = useContract();

  const [pendingAction, setPendingAction] = useState<PreparedTokenAction | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleIssue = async () => {
    if (!address) return;
    setStatus(null);
    try {
      const hash = await issue(address, '100');
      setStatus(`Issuance submitted: ${hash}`);
    } catch (err) {
      setStatus(`Issuance failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  // Stephanie.ai calls this with a parsed intent; nothing executes until the
  // operator confirms below.
  const handleVoiceIntent = () => {
    if (!address) return;
    setPendingAction(prepareVoiceCommand('ISSUE', { to: address, amount: '100' }));
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setStatus(null);
    try {
      const hash = await pendingAction.execute();
      setStatus(`${pendingAction.intent} submitted: ${hash}`);
    } catch (err) {
      setStatus(`${pendingAction.intent} failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setPendingAction(null);
    }
  };

  if (!isConnected) {
    return <p className="text-sm text-ink-400">Connect a wallet to manage NBPT.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Balance: {isLoadingBalance ? '…' : `${balance} NBPT`}
      </p>
      <p className="text-xs text-ink-400">
        KYC: {kycVerified ? 'verified' : 'not verified'} · Accreditation:{' '}
        {accredited ? 'current' : 'none'} · Offering:{' '}
        {liveOfferingCleared ? 'LIVE' : 'PRE-CLEARANCE (value paths revert)'}
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleIssue}
          disabled={isIssuePending}
          className="rounded bg-ink-800 px-3 py-1.5 text-sm hover:bg-ink-700 disabled:opacity-50"
        >
          {isIssuePending ? 'Issuing…' : 'Issue 100 NBPT'}
        </button>
        <button
          onClick={handleVoiceIntent}
          className="rounded bg-ink-800 px-3 py-1.5 text-sm hover:bg-ink-700"
        >
          🎤 Simulate voice intent
        </button>
      </div>

      {pendingAction && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="mb-2">Stephanie proposes: {pendingAction.summary}</p>
          <div className="flex gap-2">
            <button
              onClick={confirmPendingAction}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold"
            >
              Confirm &amp; sign
            </button>
            <button
              onClick={() => setPendingAction(null)}
              className="rounded bg-ink-800 px-3 py-1 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {status && <p className="break-all text-xs text-ink-400">{status}</p>}
    </div>
  );
}
