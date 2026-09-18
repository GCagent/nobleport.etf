// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title INBPT
 * @dev Interface for the NoblePort Security Token (ERC-1400 style)
 * @notice Implements partition-based token issuance for regulatory compliance
 */
interface INBPT {
    /// @notice Issues tokens to a specific partition for an account
    /// @param partition The partition identifier (e.g., RESERVE, LIQUIDITY)
    /// @param account The recipient address
    /// @param amount The amount of tokens to issue
    function issueToPartition(bytes32 partition, address account, uint256 amount) external;

    /// @notice Burns tokens from a specific partition
    /// @param partition The partition identifier
    /// @param account The account to burn from
    /// @param amount The amount to burn
    function burnFromPartition(bytes32 partition, address account, uint256 amount) external;

    /// @notice Returns the balance of an account in a specific partition
    /// @param partition The partition identifier
    /// @param account The account to query
    /// @return The balance in that partition
    function balanceOfByPartition(bytes32 partition, address account) external view returns (uint256);

    /// @notice Returns the Reserve partition identifier
    function PARTITION_RESERVE() external view returns (bytes32);

    /// @notice Returns the Liquidity partition identifier
    function PARTITION_LIQUIDITY() external view returns (bytes32);

    /// @notice Returns the Enterprise partition identifier
    function PARTITION_ENTERPRISE() external view returns (bytes32);

    /// @notice Returns the Staking partition identifier
    function PARTITION_STAKING() external view returns (bytes32);
}
