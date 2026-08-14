// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title Cross-Chain Bridge Router — Module 8
 * @notice Wanchain/Rubic bridge orchestration for multi-chain USDC settlement
 * @dev Routes cross-chain transfers through optimal bridge paths
 */
contract CrossChainBridgeRouter is IBridgeRouter {
    enum TransferStatus { INITIATED, BRIDGING, COMPLETED, FAILED, REFUNDED }

    struct Transfer {
        bytes32 id;
        address sender;
        address recipient;
        uint256 amount;
        address token;
        uint256 sourceChainId;
        uint256 destChainId;
        TransferStatus status;
        uint256 initiatedAt;
        uint256 completedAt;
        uint256 bridgeIndex; // Which bridge was used
    }

    struct BridgeConfig {
        string name;
        address adapter;
        bool active;
        uint256[] supportedChains;
        uint256 maxTransferAmount;
        uint256 feeRateBps; // basis points
    }

    // ─── State ──────────────────────────────────────────────

    mapping(bytes32 => Transfer) public transfers;
    BridgeConfig[] public bridges;
    mapping(uint256 => bool) public supportedChains;
    uint256[] private _chainIds;

    address public admin;
    uint256 public nonce;

    event TransferInitiated(bytes32 indexed transferId, uint256 destChainId, uint256 amount);
    event TransferCompleted(bytes32 indexed transferId);
    event TransferFailed(bytes32 indexed transferId);
    event BridgeAdded(uint256 indexed index, string name);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Router: not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function initiateTransfer(
        uint256 destChainId,
        address recipient,
        uint256 amount,
        address token
    ) external override returns (bytes32 transferId) {
        require(supportedChains[destChainId], "Router: unsupported chain");
        require(amount > 0, "Router: zero amount");

        transferId = keccak256(abi.encode(msg.sender, recipient, amount, destChainId, nonce++));

        uint256 bridgeIdx = _selectOptimalBridge(destChainId, amount);

        transfers[transferId] = Transfer({
            id: transferId,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            token: token,
            sourceChainId: block.chainid,
            destChainId: destChainId,
            status: TransferStatus.INITIATED,
            initiatedAt: block.timestamp,
            completedAt: 0,
            bridgeIndex: bridgeIdx
        });

        emit TransferInitiated(transferId, destChainId, amount);
    }

    function completeTransfer(
        bytes32 transferId,
        bytes calldata bridgeProof
    ) external override {
        Transfer storage t = transfers[transferId];
        require(t.status == TransferStatus.INITIATED || t.status == TransferStatus.BRIDGING, "Router: invalid status");
        require(bridgeProof.length > 0, "Router: empty proof");

        t.status = TransferStatus.COMPLETED;
        t.completedAt = block.timestamp;

        emit TransferCompleted(transferId);
    }

    function getTransferStatus(bytes32 transferId) external view override returns (uint8) {
        return uint8(transfers[transferId].status);
    }

    function getSupportedChains() external view override returns (uint256[] memory) {
        return _chainIds;
    }

    // ─── Bridge Management ──────────────────────────────────

    function addBridge(
        string calldata bridgeName,
        address adapter,
        uint256[] calldata chains,
        uint256 maxAmount,
        uint256 feeRateBps
    ) external onlyAdmin {
        bridges.push(BridgeConfig({
            name: bridgeName,
            adapter: adapter,
            active: true,
            supportedChains: chains,
            maxTransferAmount: maxAmount,
            feeRateBps: feeRateBps
        }));

        for (uint256 i = 0; i < chains.length; i++) {
            if (!supportedChains[chains[i]]) {
                supportedChains[chains[i]] = true;
                _chainIds.push(chains[i]);
            }
        }

        emit BridgeAdded(bridges.length - 1, bridgeName);
    }

    function _selectOptimalBridge(uint256 destChainId, uint256 amount) internal view returns (uint256) {
        uint256 bestBridge = type(uint256).max;
        uint256 lowestFee = type(uint256).max;

        for (uint256 i = 0; i < bridges.length; i++) {
            if (!bridges[i].active || amount > bridges[i].maxTransferAmount) continue;

            bool supportsChain = false;
            for (uint256 j = 0; j < bridges[i].supportedChains.length; j++) {
                if (bridges[i].supportedChains[j] == destChainId) {
                    supportsChain = true;
                    break;
                }
            }

            if (supportsChain && bridges[i].feeRateBps < lowestFee) {
                lowestFee = bridges[i].feeRateBps;
                bestBridge = i;
            }
        }

        require(bestBridge != type(uint256).max, "Router: no bridge available");
        return bestBridge;
    }
}
