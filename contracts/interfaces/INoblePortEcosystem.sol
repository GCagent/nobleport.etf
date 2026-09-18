// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║            NoblePort Ecosystem — Core Interfaces                 ║
 * ║  Shared interface definitions for all on-chain modules (1-8)     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

// ─── Module 1: NBPT Token ───────────────────────────────────────────

interface ITransferHook {
    function beforeTransfer(address from, address to, uint256 amount) external returns (bool);
    function afterTransfer(address from, address to, uint256 amount) external;
}

interface IGovernanceToken {
    function delegate(address delegatee) external;
    function getVotingPower(address account) external view returns (uint256);
    function snapshot() external returns (uint256 snapshotId);
}

// ─── Module 2: Permit NFT ───────────────────────────────────────────

enum PermitStatus { DRAFT, SUBMITTED, UNDER_REVIEW, ISSUED, SUSPENDED, CLOSED }

interface IPermitLifecycle {
    function createPermit(bytes32 contentHash, string calldata metadataURI) external returns (uint256 tokenId);
    function advanceStatus(uint256 tokenId, PermitStatus newStatus) external;
    function getPermitStatus(uint256 tokenId) external view returns (PermitStatus);
    function getPermitHistory(uint256 tokenId) external view returns (PermitStatus[] memory, uint256[] memory timestamps);
}

// ─── Module 3: Escrow ───────────────────────────────────────────────

interface IEscrow {
    function createEscrow(
        address payer,
        address payee,
        uint256 totalAmount,
        uint256 milestoneCount,
        uint256 disputeWindowSeconds
    ) external returns (uint256 escrowId);
    function releaseMilestone(uint256 escrowId, uint256 milestoneIndex) external;
    function disputeMilestone(uint256 escrowId, uint256 milestoneIndex, string calldata reason) external;
    function resolveDispute(uint256 escrowId, uint256 milestoneIndex, bool releaseFunds) external;
    function getEscrowBalance(uint256 escrowId) external view returns (uint256);
}

// ─── Module 4: Merkle Anchor ────────────────────────────────────────

interface IMerkleAnchor {
    function commitRoot(bytes32 root, uint256 leafCount, string calldata metadata) external;
    function verifyInclusion(bytes32 root, bytes32 leaf, bytes32[] calldata proof) external pure returns (bool);
    function getLatestRoot() external view returns (bytes32 root, uint256 timestamp, uint256 leafCount);
    function getRootHistory(uint256 fromIndex, uint256 count) external view returns (bytes32[] memory);
}

// ─── Module 5: zkSBT Credential ─────────────────────────────────────

interface ICredentialRegistry {
    function issueCredential(
        address holder,
        bytes32 credentialHash,
        uint256 credentialType,
        uint256 expiresAt
    ) external returns (uint256 tokenId);
    function verifyCredential(uint256 tokenId, bytes calldata zkProof) external view returns (bool);
    function revokeCredential(uint256 tokenId) external;
    function isCredentialValid(uint256 tokenId) external view returns (bool);
}

// ─── Module 6: Revocation Manager ───────────────────────────────────

interface IRevocationRegistry {
    function rotateRoot(bytes32 newRoot, uint256 revokedCount) external;
    function isRevoked(bytes32 credentialLeaf, bytes32[] calldata proof) external view returns (bool);
    function getCurrentRoot() external view returns (bytes32);
    function getRotationHistory() external view returns (bytes32[] memory roots, uint256[] memory timestamps);
}

// ─── Module 7: Governance Bridge ────────────────────────────────────

interface IGovernanceBridge {
    function relayVote(bytes32 proposalId, uint256 forVotes, uint256 againstVotes, bytes calldata snapshotProof) external;
    function executeProposal(bytes32 proposalId) external;
    function getProposalResult(bytes32 proposalId) external view returns (bool passed, uint256 forVotes, uint256 againstVotes);
}

// ─── Module 8: Bridge Router ────────────────────────────────────────

interface IBridgeRouter {
    function initiateTransfer(uint256 destChainId, address recipient, uint256 amount, address token) external returns (bytes32 transferId);
    function completeTransfer(bytes32 transferId, bytes calldata bridgeProof) external;
    function getTransferStatus(bytes32 transferId) external view returns (uint8 status);
    function getSupportedChains() external view returns (uint256[] memory chainIds);
}

// ─── Module 36: Fractional Ownership ────────────────────────────────

interface IFractionalOwnership {
    function tokenizeProperty(bytes32 propertyHash, uint256 totalShares, uint256 pricePerShare) external returns (uint256 propertyId);
    function purchaseShares(uint256 propertyId, uint256 shareCount) external;
    function getShareBalance(uint256 propertyId, address holder) external view returns (uint256);
    function getMinimumShare() external pure returns (uint256); // Enforces 25% minimum
}

// ─── Module 37: USDC Distribution ───────────────────────────────────

interface IDistributor {
    function scheduleDistribution(uint256 propertyId, uint256 totalAmount) external returns (uint256 distributionId);
    function executeDistribution(uint256 distributionId) external;
    function claimDistribution(uint256 distributionId) external;
    function getUnclaimedAmount(uint256 distributionId, address holder) external view returns (uint256);
}

// ─── Module 38: Property NFT ────────────────────────────────────────

interface IPropertyNFT {
    function mintProperty(
        bytes32 deedHash,
        bytes32 appraisalHash,
        string calldata photosURI,
        string calldata metadataURI
    ) external returns (uint256 tokenId);
    function updateAppraisal(uint256 tokenId, bytes32 newAppraisalHash) external;
    function getPropertyMetadata(uint256 tokenId) external view returns (bytes32 deedHash, bytes32 appraisalHash, string memory photosURI);
}

// ─── Module 41: Secondary Market ────────────────────────────────────

interface ISecondaryMarket {
    function createListing(uint256 propertyId, uint256 shareCount, uint256 pricePerShare) external returns (uint256 listingId);
    function fillOrder(uint256 listingId) external;
    function cancelListing(uint256 listingId) external;
    function checkTransferCompliance(address from, address to, uint256 propertyId) external view returns (bool);
}
