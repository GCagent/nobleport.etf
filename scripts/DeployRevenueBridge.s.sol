// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/RevenueBridge.sol";

/**
 * @title DeployRevenueBridge
 * @notice Deployment script for the RevenueBridge contract
 *
 * Usage:
 *   # Local deployment (anvil)
 *   forge script scripts/DeployRevenueBridge.s.sol --rpc-url http://localhost:8545 --broadcast
 *
 *   # Testnet deployment (Sepolia)
 *   forge script scripts/DeployRevenueBridge.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
 *
 *   # Mainnet deployment (with hardware wallet)
 *   forge script scripts/DeployRevenueBridge.s.sol --rpc-url $MAINNET_RPC_URL --broadcast --verify --ledger
 *
 * Required environment variables:
 *   - NBPT_TOKEN_ADDRESS: Address of the deployed NBPT token
 *   - BRIDGE_OPERATOR: Address authorized to bridge revenue
 *   - OWNER_ADDRESS: Contract owner address (optional, defaults to deployer)
 */
contract DeployRevenueBridge is Script {
    function run() external {
        // Load configuration from environment
        address nbptToken = vm.envAddress("NBPT_TOKEN_ADDRESS");
        address operator = vm.envAddress("BRIDGE_OPERATOR");
        address owner = vm.envOr("OWNER_ADDRESS", msg.sender);

        console.log("Deploying RevenueBridge...");
        console.log("  NBPT Token:", nbptToken);
        console.log("  Operator:", operator);
        console.log("  Owner:", owner);

        vm.startBroadcast();

        RevenueBridge bridge = new RevenueBridge(nbptToken, operator, owner);

        vm.stopBroadcast();

        console.log("");
        console.log("RevenueBridge deployed to:", address(bridge));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Grant RevenueBridge minter role on NBPT contract");
        console.log("  2. Configure webhook server with bridge address");
        console.log("  3. Verify contract on Etherscan (if not done via --verify)");
    }
}

/**
 * @title DeployRevenueBridgeLocal
 * @notice Local deployment script with mock NBPT for testing
 */
contract DeployRevenueBridgeLocal is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        console.log("Deployer:", deployer);

        vm.startBroadcast();

        // Deploy mock NBPT for local testing
        MockNBPTDeployable mockNbpt = new MockNBPTDeployable();
        console.log("MockNBPT deployed to:", address(mockNbpt));

        // Deploy bridge
        RevenueBridge bridge = new RevenueBridge(
            address(mockNbpt),
            deployer, // Deployer is operator for local testing
            deployer  // Deployer is owner
        );
        console.log("RevenueBridge deployed to:", address(bridge));

        vm.stopBroadcast();
    }
}

/**
 * @dev Minimal mock for deployment script
 */
contract MockNBPTDeployable {
    bytes32 public constant PARTITION_RESERVE = keccak256("RESERVE");
    bytes32 public constant PARTITION_LIQUIDITY = keccak256("LIQUIDITY");
    bytes32 public constant PARTITION_ENTERPRISE = keccak256("ENTERPRISE");
    bytes32 public constant PARTITION_STAKING = keccak256("STAKING");

    mapping(bytes32 => mapping(address => uint256)) private _balances;

    function issueToPartition(bytes32 partition, address account, uint256 amount) external {
        _balances[partition][account] += amount;
    }

    function burnFromPartition(bytes32 partition, address account, uint256 amount) external {
        _balances[partition][account] -= amount;
    }

    function balanceOfByPartition(bytes32 partition, address account) external view returns (uint256) {
        return _balances[partition][account];
    }
}
