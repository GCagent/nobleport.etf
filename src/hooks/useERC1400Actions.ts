'use client';

/**
 * Wagmi write/read hooks for NBPTSecurityToken1400 (ERC-1400 family).
 *
 * Naming follows the contract, not generic ERC-1400 references:
 *   mint → issueByPartition, burn → redeemByPartition (holder-initiated),
 *   transfer → transferByPartition, plus the USDC subscribe/redeem rail.
 *
 * All value-moving paths are subject to on-chain compliance (KYC,
 * accreditation, lockups, the Cooley live-offering gate), so a write can
 * succeed in the wallet and still revert — surface `error` in the UI.
 */

import { useCallback } from 'react';
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { formatUnits, parseUnits, type Hex } from 'viem';
import {
  DEFAULT_PARTITION,
  ERC1400_ABI,
  ERC20_ABI,
  NBPT_DECIMALS,
  NBPT_TOKEN_ADDRESS,
  STATUS_TRANSFER_SUCCESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
} from '@/config/contracts';

type Address = `0x${string}`;

const EMPTY_DATA: Hex = '0x';

/** Shared shape returned by every write hook below. */
function useTokenWrite() {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  return {
    writeContractAsync,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    error: error ?? receipt.error ?? null,
    reset,
  };
}

// ───────────────────────── Write hooks ─────────────────────────

/** Mint = ERC-1594 issuance. Caller needs ISSUER_ROLE and the live gate open. */
export function useIssueTokens() {
  const { writeContractAsync, ...state } = useTokenWrite();

  const issue = useCallback(
    (to: Address, amount: string, partition: Hex = DEFAULT_PARTITION, data: Hex = EMPTY_DATA) =>
      writeContractAsync({
        address: NBPT_TOKEN_ADDRESS,
        abi: ERC1400_ABI,
        functionName: 'issueByPartition',
        args: [partition, to, parseUnits(amount, NBPT_DECIMALS), data],
      }),
    [writeContractAsync],
  );

  return { issue, ...state };
}

/** Compliance-checked partition transfer from the connected wallet. */
export function useTransferTokens() {
  const { writeContractAsync, ...state } = useTokenWrite();

  const transfer = useCallback(
    (to: Address, amount: string, partition: Hex = DEFAULT_PARTITION, data: Hex = EMPTY_DATA) =>
      writeContractAsync({
        address: NBPT_TOKEN_ADDRESS,
        abi: ERC1400_ABI,
        functionName: 'transferByPartition',
        args: [partition, to, parseUnits(amount, NBPT_DECIMALS), data],
      }),
    [writeContractAsync],
  );

  return { transfer, ...state };
}

/**
 * Burn = holder-initiated redemption of the connected wallet's own tokens.
 * The contract has no third-party burn; forced redemption is controllerRedeem
 * (CONTROLLER_ROLE) and deliberately not exposed here.
 */
export function useRedeemTokens() {
  const { writeContractAsync, ...state } = useTokenWrite();

  const redeem = useCallback(
    (amount: string, partition: Hex = DEFAULT_PARTITION, data: Hex = EMPTY_DATA) =>
      writeContractAsync({
        address: NBPT_TOKEN_ADDRESS,
        abi: ERC1400_ABI,
        functionName: 'redeemByPartition',
        args: [partition, parseUnits(amount, NBPT_DECIMALS), data],
      }),
    [writeContractAsync],
  );

  return { redeem, ...state };
}

/**
 * USDC subscription rail: approve USDC to the token contract, then subscribe.
 * Amounts at/above humanReviewThresholdUSDC need an EXECUTED
 * HumanApprovalGateway financial decision id; pass 0 below the threshold.
 */
export function useSubscribeUSDC() {
  const { writeContractAsync, ...state } = useTokenWrite();

  const approveUsdc = useCallback(
    (usdcAmount: string) =>
      writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [NBPT_TOKEN_ADDRESS, parseUnits(usdcAmount, USDC_DECIMALS)],
      }),
    [writeContractAsync],
  );

  const subscribe = useCallback(
    (usdcAmount: string, decisionId: bigint = 0n, partition: Hex = DEFAULT_PARTITION) =>
      writeContractAsync({
        address: NBPT_TOKEN_ADDRESS,
        abi: ERC1400_ABI,
        functionName: 'subscribe',
        args: [partition, parseUnits(usdcAmount, USDC_DECIMALS), decisionId],
      }),
    [writeContractAsync],
  );

  return { approveUsdc, subscribe, ...state };
}

/** Redeem NBPT back to USDC at the peg price, from the on-contract reserve. */
export function useRedeemForUSDC() {
  const { writeContractAsync, ...state } = useTokenWrite();

  const redeemForUsdc = useCallback(
    (tokenAmount: string, decisionId: bigint = 0n, partition: Hex = DEFAULT_PARTITION) =>
      writeContractAsync({
        address: NBPT_TOKEN_ADDRESS,
        abi: ERC1400_ABI,
        functionName: 'redeemForUSDC',
        args: [partition, parseUnits(tokenAmount, NBPT_DECIMALS), decisionId],
      }),
    [writeContractAsync],
  );

  return { redeemForUsdc, ...state };
}

// ───────────────────────── Read hooks ─────────────────────────

export function useTokenBalance(address?: Address) {
  const { data, refetch, isLoading } = useReadContract({
    address: NBPT_TOKEN_ADDRESS,
    abi: ERC1400_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    balance: data !== undefined ? formatUnits(data, NBPT_DECIMALS) : '0',
    rawBalance: data,
    refetch,
    isLoading,
  };
}

export function usePartitionBalance(address?: Address, partition: Hex = DEFAULT_PARTITION) {
  const { data, refetch, isLoading } = useReadContract({
    address: NBPT_TOKEN_ADDRESS,
    abi: ERC1400_ABI,
    functionName: 'balanceOfByPartition',
    args: address ? [partition, address] : undefined,
    query: { enabled: !!address },
  });

  return {
    balance: data !== undefined ? formatUnits(data, NBPT_DECIMALS) : '0',
    rawBalance: data,
    refetch,
    isLoading,
  };
}

/**
 * ERC-1594 pre-flight via canTransferByPartition (explicit `from`, so it works
 * for any sender, not just msg.sender). `reason` is a bytes32-packed string
 * like "receiver not KYC".
 */
export function useCanTransfer(
  from?: Address,
  to?: Address,
  amount?: string,
  partition: Hex = DEFAULT_PARTITION,
) {
  const enabled = !!from && !!to && !!amount;
  const { data, refetch, isLoading } = useReadContract({
    address: NBPT_TOKEN_ADDRESS,
    abi: ERC1400_ABI,
    functionName: 'canTransferByPartition',
    args: enabled
      ? [partition, from, to, parseUnits(amount, NBPT_DECIMALS), EMPTY_DATA]
      : undefined,
    query: { enabled },
  });

  const code = data?.[0];
  return {
    isAllowed: code === STATUS_TRANSFER_SUCCESS,
    statusCode: code,
    reason: data ? decodeBytes32Reason(data[1]) : undefined,
    check: refetch,
    isLoading,
  };
}

/** KYC / accreditation / freeze / lockup record for an investor. */
export function useInvestorStatus(address?: Address) {
  const { data, refetch, isLoading } = useReadContract({
    address: NBPT_TOKEN_ADDRESS,
    abi: ERC1400_ABI,
    functionName: 'investors',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    kycVerified: data?.[0] ?? false,
    frozen: data?.[1] ?? false,
    accredited: data?.[2] ?? false,
    accreditedUntil: data?.[3],
    lockupUntil: data?.[5],
    refetch,
    isLoading,
  };
}

/** Live-offering (Cooley gate) status plus peg/issuance state. */
export function useOfferingStatus() {
  const live = useReadContract({
    address: NBPT_TOKEN_ADDRESS,
    abi: ERC1400_ABI,
    functionName: 'liveOfferingCleared',
  });
  const issuable = useReadContract({
    address: NBPT_TOKEN_ADDRESS,
    abi: ERC1400_ABI,
    functionName: 'isIssuable',
  });
  const peg = useReadContract({
    address: NBPT_TOKEN_ADDRESS,
    abi: ERC1400_ABI,
    functionName: 'pegPriceUSDC',
  });

  return {
    liveOfferingCleared: live.data ?? false,
    isIssuable: issuable.data ?? false,
    pegPriceUSDC: peg.data !== undefined ? formatUnits(peg.data, USDC_DECIMALS) : undefined,
    isLoading: live.isLoading || issuable.isLoading || peg.isLoading,
  };
}

function decodeBytes32Reason(reason: Hex): string {
  const bytes = reason.slice(2).match(/.{2}/g) ?? [];
  let out = '';
  for (const byte of bytes) {
    const charCode = parseInt(byte, 16);
    if (charCode === 0) break;
    out += String.fromCharCode(charCode);
  }
  return out;
}

// ─────────────────── Stephanie.ai voice bridge ───────────────────

export type VoiceTokenIntent = 'ISSUE' | 'TRANSFER' | 'REDEEM' | 'SUBSCRIBE' | 'REDEEM_USDC';

export interface VoiceTokenParams {
  to?: Address;
  amount: string;
  decisionId?: bigint;
  partition?: Hex;
}

export interface PreparedTokenAction {
  intent: VoiceTokenIntent;
  /** Voice-readable description for the operator to confirm. */
  summary: string;
  /** Submits the transaction to the connected wallet for signing. */
  execute: () => Promise<Hex>;
}

/**
 * Maps Stephanie.ai voice intents to token actions — as PROPOSALS only.
 *
 * Per the Nemoclaw signer-gateway policy (§10.2, src/lib/nemoclaw), requests
 * that originate directly from model output must never reach a signer. So a
 * voice command does not execute anything: it returns a PreparedTokenAction
 * whose `execute` the UI may only call from an explicit human confirmation
 * (button press / wallet signature), keeping the human gate intact.
 */
export function useVoiceContractActions() {
  const { issue } = useIssueTokens();
  const { transfer } = useTransferTokens();
  const { redeem } = useRedeemTokens();
  const { subscribe } = useSubscribeUSDC();
  const { redeemForUsdc } = useRedeemForUSDC();

  const prepareVoiceCommand = useCallback(
    (intent: VoiceTokenIntent, params: VoiceTokenParams): PreparedTokenAction => {
      const { to, amount, decisionId = 0n, partition } = params;

      switch (intent) {
        case 'ISSUE':
          if (!to) throw new Error('ISSUE requires a recipient address');
          return {
            intent,
            summary: `Issue ${amount} NBPT to ${to}`,
            execute: () => issue(to, amount, partition),
          };
        case 'TRANSFER':
          if (!to) throw new Error('TRANSFER requires a recipient address');
          return {
            intent,
            summary: `Transfer ${amount} NBPT to ${to}`,
            execute: () => transfer(to, amount, partition),
          };
        case 'REDEEM':
          return {
            intent,
            summary: `Redeem (burn) ${amount} NBPT from the connected wallet`,
            execute: () => redeem(amount, partition),
          };
        case 'SUBSCRIBE':
          return {
            intent,
            summary: `Subscribe ${amount} USDC for newly issued NBPT at the peg price`,
            execute: () => subscribe(amount, decisionId, partition),
          };
        case 'REDEEM_USDC':
          return {
            intent,
            summary: `Redeem ${amount} NBPT for USDC from the reserve`,
            execute: () => redeemForUsdc(amount, decisionId, partition),
          };
        default:
          throw new Error(`Unknown voice intent: ${intent satisfies never}`);
      }
    },
    [issue, transfer, redeem, subscribe, redeemForUsdc],
  );

  return { prepareVoiceCommand };
}
