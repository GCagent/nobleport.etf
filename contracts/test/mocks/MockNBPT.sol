// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../interfaces/INBPT.sol";

/**
 * @title MockNBPT
 * @dev Mock implementation of NBPT for testing RevenueBridge
 */
contract MockNBPT is INBPT {
    bytes32 public constant override PARTITION_RESERVE = keccak256("RESERVE");
    bytes32 public constant override PARTITION_LIQUIDITY = keccak256("LIQUIDITY");
    bytes32 public constant override PARTITION_ENTERPRISE = keccak256("ENTERPRISE");
    bytes32 public constant override PARTITION_STAKING = keccak256("STAKING");

    mapping(bytes32 => mapping(address => uint256)) private _partitionBalances;
    mapping(bytes32 => uint256) private _partitionTotals;

    event Issued(bytes32 indexed partition, address indexed account, uint256 amount);
    event Burned(bytes32 indexed partition, address indexed account, uint256 amount);

    function issueToPartition(bytes32 partition, address account, uint256 amount) external override {
        _partitionBalances[partition][account] += amount;
        _partitionTotals[partition] += amount;
        emit Issued(partition, account, amount);
    }

    function burnFromPartition(bytes32 partition, address account, uint256 amount) external override {
        require(_partitionBalances[partition][account] >= amount, "Insufficient balance");
        _partitionBalances[partition][account] -= amount;
        _partitionTotals[partition] -= amount;
        emit Burned(partition, account, amount);
    }

    function balanceOfByPartition(bytes32 partition, address account) external view override returns (uint256) {
        return _partitionBalances[partition][account];
    }

    function totalSupplyByPartition(bytes32 partition) external view returns (uint256) {
        return _partitionTotals[partition];
    }
}
