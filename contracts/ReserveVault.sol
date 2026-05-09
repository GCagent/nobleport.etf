// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReserveVault — NBPT Reserve Custody & Yield Vault Template
 * @author NoblePort ETF
 * @notice Allowlisted vault that holds USDC backing for NBPT.  Two flavors:
 *         CustodyVault (simple hold) and AaveVault (yield-bearing via Aave V3).
 * @dev Only callable by the NBPT contract (TREASURY_ROLE holder).
 *      Part of the Hybrid Reserve strategy (C3): 30% liquid in NBPT, 70% in vaults.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/INBPTStability.sol";

// ─────────────────────────────────────────────────────────────
//  Base: shared deposit / withdraw / accounting
// ─────────────────────────────────────────────────────────────

abstract contract BaseReserveVault is IReserveVault, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant VAULT_OPERATOR_ROLE = keccak256("VAULT_OPERATOR_ROLE");

    address public immutable override asset;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _asset, address admin) {
        require(_asset != address(0), "zero asset");
        require(admin  != address(0), "zero admin");
        asset = _asset;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VAULT_OPERATOR_ROLE, admin);
    }

    function deposit(uint256 amount) external virtual override onlyRole(VAULT_OPERATOR_ROLE) nonReentrant {
        require(amount > 0, "zero amount");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _afterDeposit(amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount, address to) external virtual override onlyRole(VAULT_OPERATOR_ROLE) nonReentrant {
        require(amount > 0, "zero amount");
        require(to != address(0), "zero to");
        _beforeWithdraw(amount);
        IERC20(asset).safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function _afterDeposit(uint256 amount) internal virtual;
    function _beforeWithdraw(uint256 amount) internal virtual;

    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

// ─────────────────────────────────────────────────────────────
//  CustodyVault — simple USDC hold, no yield, full transparency
// ─────────────────────────────────────────────────────────────

contract CustodyVault is BaseReserveVault {
    constructor(address _usdc, address admin)
        BaseReserveVault(_usdc, admin) {}

    function reserveBalance() external view override returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function _afterDeposit(uint256) internal override {}
    function _beforeWithdraw(uint256) internal override {}
}

// ─────────────────────────────────────────────────────────────
//  AaveVault — deposits USDC into Aave V3, tracks aToken balance
// ─────────────────────────────────────────────────────────────

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

contract AaveVault is BaseReserveVault {
    IAavePool public immutable aavePool;
    IAToken   public immutable aToken;

    // Arbitrum One Aave V3 Pool
    address public constant AAVE_POOL_ARBITRUM = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

    constructor(
        address _usdc,
        address _aToken,
        address admin
    ) BaseReserveVault(_usdc, admin) {
        require(_aToken != address(0), "zero aToken");
        aavePool = IAavePool(AAVE_POOL_ARBITRUM);
        aToken   = IAToken(_aToken);
    }

    function reserveBalance() external view override returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    function _afterDeposit(uint256 amount) internal override {
        IERC20(asset).approve(address(aavePool), amount);
        aavePool.supply(asset, amount, address(this), 0);
    }

    function _beforeWithdraw(uint256 amount) internal override {
        aavePool.withdraw(asset, amount, address(this));
    }
}
