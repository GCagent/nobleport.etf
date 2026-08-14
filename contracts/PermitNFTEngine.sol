// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title Permit NFT Engine — Module 2
 * @notice ERC-721 permit lifecycle (draft → submitted → issued → closed)
 * @dev Non-transferable permit tokens with full lifecycle tracking
 */
contract PermitNFTEngine is IPermitLifecycle {
    // ─── State ──────────────────────────────────────────────

    struct Permit {
        uint256 tokenId;
        address applicant;
        bytes32 contentHash;
        string metadataURI;
        PermitStatus status;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct StatusChange {
        PermitStatus status;
        uint256 timestamp;
        address changedBy;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => Permit) public permits;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => StatusChange[]) private _statusHistory;

    // Access control
    mapping(address => bool) public isReviewer;
    mapping(address => bool) public isIssuer;
    address public admin;

    // ERC-721 metadata
    string public name = "NoblePort Permit";
    string public symbol = "NBPT-PERMIT";

    event PermitCreated(uint256 indexed tokenId, address indexed applicant, bytes32 contentHash);
    event PermitStatusAdvanced(uint256 indexed tokenId, PermitStatus oldStatus, PermitStatus newStatus);
    event ReviewerUpdated(address indexed account, bool isReviewer);
    event IssuerUpdated(address indexed account, bool isIssuer);

    modifier onlyAdmin() {
        require(msg.sender == admin, "PermitNFT: not admin");
        _;
    }

    modifier onlyReviewerOrIssuer() {
        require(isReviewer[msg.sender] || isIssuer[msg.sender], "PermitNFT: unauthorized");
        _;
    }

    constructor() {
        admin = msg.sender;
        isIssuer[msg.sender] = true;
    }

    // ─── Lifecycle ──────────────────────────────────────────

    function createPermit(
        bytes32 contentHash,
        string calldata metadataURI
    ) external override returns (uint256 tokenId) {
        tokenId = _nextTokenId++;

        permits[tokenId] = Permit({
            tokenId: tokenId,
            applicant: msg.sender,
            contentHash: contentHash,
            metadataURI: metadataURI,
            status: PermitStatus.DRAFT,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        ownerOf[tokenId] = msg.sender;
        balanceOf[msg.sender]++;

        _statusHistory[tokenId].push(StatusChange({
            status: PermitStatus.DRAFT,
            timestamp: block.timestamp,
            changedBy: msg.sender
        }));

        emit PermitCreated(tokenId, msg.sender, contentHash);
    }

    function advanceStatus(
        uint256 tokenId,
        PermitStatus newStatus
    ) external override {
        Permit storage permit = permits[tokenId];
        require(permit.createdAt != 0, "PermitNFT: nonexistent");

        PermitStatus current = permit.status;
        _validateTransition(current, newStatus, msg.sender, permit.applicant);

        PermitStatus oldStatus = permit.status;
        permit.status = newStatus;
        permit.updatedAt = block.timestamp;

        _statusHistory[tokenId].push(StatusChange({
            status: newStatus,
            timestamp: block.timestamp,
            changedBy: msg.sender
        }));

        emit PermitStatusAdvanced(tokenId, oldStatus, newStatus);
    }

    function getPermitStatus(uint256 tokenId) external view override returns (PermitStatus) {
        require(permits[tokenId].createdAt != 0, "PermitNFT: nonexistent");
        return permits[tokenId].status;
    }

    function getPermitHistory(
        uint256 tokenId
    ) external view override returns (PermitStatus[] memory statuses, uint256[] memory timestamps) {
        StatusChange[] storage history = _statusHistory[tokenId];
        statuses = new PermitStatus[](history.length);
        timestamps = new uint256[](history.length);
        for (uint256 i = 0; i < history.length; i++) {
            statuses[i] = history[i].status;
            timestamps[i] = history[i].timestamp;
        }
    }

    // ─── Transition validation ──────────────────────────────

    function _validateTransition(
        PermitStatus current,
        PermitStatus next,
        address caller,
        address applicant
    ) internal view {
        if (current == PermitStatus.DRAFT && next == PermitStatus.SUBMITTED) {
            require(caller == applicant, "PermitNFT: only applicant can submit");
        } else if (current == PermitStatus.SUBMITTED && next == PermitStatus.UNDER_REVIEW) {
            require(isReviewer[caller] || isIssuer[caller], "PermitNFT: only reviewer");
        } else if (current == PermitStatus.UNDER_REVIEW && next == PermitStatus.ISSUED) {
            require(isIssuer[caller], "PermitNFT: only issuer");
        } else if (current == PermitStatus.UNDER_REVIEW && next == PermitStatus.SUBMITTED) {
            require(isReviewer[caller], "PermitNFT: only reviewer can reject to submitted");
        } else if (next == PermitStatus.SUSPENDED) {
            require(isIssuer[caller], "PermitNFT: only issuer can suspend");
        } else if (current == PermitStatus.ISSUED && next == PermitStatus.CLOSED) {
            require(isIssuer[caller] || caller == applicant, "PermitNFT: unauthorized close");
        } else {
            revert("PermitNFT: invalid transition");
        }
    }

    // ─── Admin ──────────────────────────────────────────────

    function setReviewer(address account, bool status) external onlyAdmin {
        isReviewer[account] = status;
        emit ReviewerUpdated(account, status);
    }

    function setIssuer(address account, bool status) external onlyAdmin {
        isIssuer[account] = status;
        emit IssuerUpdated(account, status);
    }
}
