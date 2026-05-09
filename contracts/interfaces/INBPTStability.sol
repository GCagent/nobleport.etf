// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReserveVault {
    function reserveBalance() external view returns (uint256);
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount, address to) external;
    function asset() external view returns (address);
}

interface IAttestationRegistry {
    function isFresh() external view returns (bool);
    function latestAttestedReserves() external view returns (uint256);
    function latestTimestamp() external view returns (uint256);
}

interface ITWAPOracleAdapter {
    function deviation() external view returns (int256);
    function isMintBraked() external view returns (bool);
    function isIncident() external view returns (bool);
}

interface INBPT {
    event Minted(address indexed to, uint256 nbptAmount, uint256 usdcPaid, uint256 feeAmount);
    event Redeemed(address indexed from, uint256 nbptAmount, uint256 usdcReturned, uint256 feeAmount);
    event RedemptionQueued(uint256 indexed claimId, address indexed redeemer, uint256 nbptAmount);
    event RedemptionClaimed(uint256 indexed claimId, address indexed redeemer, uint256 usdcAmount);
    event MintBrakeEngaged(int256 deviation);
    event MintBrakeReleased(int256 deviation);
    event IncidentDeclared(int256 deviation);
    event IncidentResolved();
    event DailyCapUpdated(uint256 newMintCap, uint256 newRedeemCap);
    event VaultAdded(address indexed vault);
    event VaultRemoved(address indexed vault);
}
