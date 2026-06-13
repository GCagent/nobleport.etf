/**
 * NBPTSecurityToken1400 — on-chain configuration.
 *
 * The ABI below mirrors contracts/NBPTSecurityToken1400.sol exactly. The
 * contract is an ERC-1400 family token (ERC-20 core + ERC-1410 partitions +
 * ERC-1594 restrictions + ERC-1643 documents + ERC-1644 controller), NOT the
 * generic `mintWithData`/`burnWithData` shape some ERC-1400 references use:
 *   - minting   → issue / issueByPartition        (ISSUER_ROLE, Cooley-gated)
 *   - burning   → redeem / redeemByPartition      (holder-initiated)
 *   - transfers → transfer / transferByPartition  (compliance-checked)
 *   - USDC rail → subscribe / redeemForUSDC       (Cooley-gated)
 */

import { stringToHex } from 'viem';

// bytes32("default") — the contract's DEFAULT_PARTITION constant.
export const DEFAULT_PARTITION = stringToHex('default', { size: 32 });

// ERC-1066 status byte returned by canTransfer* when a transfer is allowed.
export const STATUS_TRANSFER_SUCCESS = '0x51';

export const NBPT_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_NBPT_TOKEN_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

// Circle USDC. Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
// Base Sepolia:              0x036CbD53842c5426634e7929541eC2318f3dCF7e
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const USDC_DECIMALS = 6;
export const NBPT_DECIMALS = 18;

export const ERC1400_ABI = [
  // ── ERC-20 core ──
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'transfer', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },

  // ── ERC-1410 partitions ──
  {
    type: 'function', name: 'balanceOfByPartition', stateMutability: 'view',
    inputs: [{ name: 'partition', type: 'bytes32' }, { name: 'holder', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'partitionsOf', stateMutability: 'view',
    inputs: [{ name: 'holder', type: 'address' }], outputs: [{ type: 'bytes32[]' }],
  },
  {
    type: 'function', name: 'totalSupplyByPartition', stateMutability: 'view',
    inputs: [{ name: 'partition', type: 'bytes32' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'transferByPartition', stateMutability: 'nonpayable',
    inputs: [
      { name: 'partition', type: 'bytes32' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  { type: 'function', name: 'granularity', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },

  // ── ERC-1594 issuance / redemption / restrictions ──
  {
    type: 'function', name: 'issue', stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'issueByPartition', stateMutability: 'nonpayable',
    inputs: [
      { name: 'partition', type: 'bytes32' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'redeem', stateMutability: 'nonpayable',
    inputs: [{ name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }],
    outputs: [],
  },
  {
    type: 'function', name: 'redeemByPartition', stateMutability: 'nonpayable',
    inputs: [
      { name: 'partition', type: 'bytes32' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'canTransfer', stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: 'code', type: 'bytes1' }, { name: 'reason', type: 'bytes32' }],
  },
  {
    type: 'function', name: 'canTransferByPartition', stateMutability: 'view',
    inputs: [
      { name: 'partition', type: 'bytes32' },
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [
      { name: 'code', type: 'bytes1' },
      { name: 'reason', type: 'bytes32' },
      { name: 'destinationPartition', type: 'bytes32' },
    ],
  },
  { type: 'function', name: 'isIssuable', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },

  // ── Compliance views ──
  {
    type: 'function', name: 'investors', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'kycVerified', type: 'bool' },
      { name: 'frozen', type: 'bool' },
      { name: 'accredited', type: 'bool' },
      { name: 'accreditedUntil', type: 'uint64' },
      { name: 'evidenceHash', type: 'bytes32' },
      { name: 'lockupUntil', type: 'uint64' },
    ],
  },
  {
    type: 'function', name: 'isAccredited', stateMutability: 'view',
    inputs: [{ name: 'investor', type: 'address' }], outputs: [{ type: 'bool' }],
  },

  // ── USDC subscription / redemption rail (Cooley-gated) ──
  { type: 'function', name: 'liveOfferingCleared', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'pegPriceUSDC', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'usdcReserve', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'humanReviewThresholdUSDC', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'subscribe', stateMutability: 'nonpayable',
    inputs: [
      { name: 'partition', type: 'bytes32' },
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'decisionId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'redeemForUSDC', stateMutability: 'nonpayable',
    inputs: [
      { name: 'partition', type: 'bytes32' },
      { name: 'tokens', type: 'uint256' },
      { name: 'decisionId', type: 'uint256' },
    ],
    outputs: [],
  },

  // ── ERC-1643 documents ──
  {
    type: 'function', name: 'getDocument', stateMutability: 'view',
    inputs: [{ name: 'docName', type: 'bytes32' }],
    outputs: [
      { name: 'uri', type: 'string' },
      { name: 'docHash', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  { type: 'function', name: 'getAllDocuments', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32[]' }] },
  {
    type: 'function', name: 'setDocument', stateMutability: 'nonpayable',
    inputs: [
      { name: 'docName', type: 'bytes32' },
      { name: 'uri', type: 'string' },
      { name: 'docHash', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

// Minimal ERC-20 surface for the USDC leg of subscribe().
export const ERC20_ABI = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;
