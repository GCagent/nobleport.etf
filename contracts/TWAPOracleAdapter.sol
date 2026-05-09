// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TWAPOracleAdapter — Uniswap V3 TWAP Peg Brake for NBPT
 * @author NoblePort ETF
 * @notice Reads the NBPT/USDC Uniswap V3 pool TWAP to detect peg deviation.
 *         Used as a brake-only oracle: disables mint when deviation > 0.50%,
 *         declares incident when > 1.00%. Redeem always stays on.
 * @dev Targets Arbitrum One. TWAP window defaults to 30 minutes to resist manipulation.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/INBPTStability.sol";

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
    function slot0()
        external view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract TWAPOracleAdapter is ITWAPOracleAdapter, AccessControl {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    address public pool;
    uint32  public twapWindow;  // seconds

    uint256 public constant MINT_BRAKE_BPS  = 50;   // 0.50%
    uint256 public constant INCIDENT_BPS    = 100;  // 1.00%
    uint256 public constant BPS_DENOM       = 10_000;

    // Uniswap V3 tick math: each tick ≈ 1 bps of price.
    // For a 1:1 stablecoin pair the reference tick is 0 (price = 1.0).
    int24 public constant REFERENCE_TICK = 0;

    bool public nbptIsToken0;

    event PoolUpdated(address indexed newPool);
    event TWAPWindowUpdated(uint32 newWindow);

    constructor(address admin, address _pool, uint32 _twapWindow) {
        require(admin != address(0), "zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        if (_pool != address(0)) {
            _setPool(_pool);
        }
        twapWindow = _twapWindow == 0 ? 1800 : _twapWindow; // default 30 min
    }

    // ============ Configuration ============

    function setPool(address _pool) external onlyRole(OPERATOR_ROLE) {
        _setPool(_pool);
    }

    function _setPool(address _pool) internal {
        require(_pool != address(0), "zero pool");
        pool = _pool;
        address t0 = IUniswapV3Pool(_pool).token0();
        // NBPT is whichever token is NOT USDC
        nbptIsToken0 = (t0 != 0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
        emit PoolUpdated(_pool);
    }

    function setTWAPWindow(uint32 _window) external onlyRole(OPERATOR_ROLE) {
        require(_window >= 300, "window too short"); // min 5 min
        twapWindow = _window;
        emit TWAPWindowUpdated(_window);
    }

    // ============ TWAP Reading ============

    function twapTick() public view returns (int24) {
        require(pool != address(0), "pool not set");

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapWindow;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);

        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 avgTick   = int24(tickDelta / int56(int32(twapWindow)));

        return avgTick;
    }

    function deviation() external view override returns (int256) {
        if (pool == address(0)) return 0;
        int24 tick = twapTick();
        int256 delta = int256(tick) - int256(REFERENCE_TICK);
        // If NBPT is token1, a positive tick means NBPT is cheaper (depeg down)
        // If NBPT is token0, a negative tick means NBPT is cheaper
        if (!nbptIsToken0) {
            delta = -delta;
        }
        return delta;
    }

    function _absDeviation() internal view returns (uint256) {
        if (pool == address(0)) return 0;
        int24 tick = twapTick();
        int256 delta = int256(tick) - int256(REFERENCE_TICK);
        return delta >= 0 ? uint256(delta) : uint256(-delta);
    }

    function isMintBraked() external view override returns (bool) {
        return _absDeviation() >= MINT_BRAKE_BPS;
    }

    function isIncident() external view override returns (bool) {
        return _absDeviation() >= INCIDENT_BPS;
    }

    // ============ Convenience ============

    function currentTick() external view returns (int24 tick) {
        require(pool != address(0), "pool not set");
        (, tick, , , , , ) = IUniswapV3Pool(pool).slot0();
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
