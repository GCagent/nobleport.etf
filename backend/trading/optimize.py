"""
OctaStackTrader — Parameter Optimization

The core of the "automated backtesting loop": grid-search a strategy's
parameters over historical candles, scoring each combination with the
:class:`~backend.trading.backtest.Backtester`, and return ranked results.

This is what an MCP backtesting server (or Claude directly) calls to find
profitable parameters for SuperTrend/ADX on 4h BTC/ETH/SOL.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, replace

from .backtest import Backtester, BacktestResult
from .broker import Candles
from .config import TradingConfig

# Metrics on BacktestResult that can be optimized for (all "higher is better").
_SORT_KEYS = {
    "sharpe", "total_return_pct", "profit_factor", "win_rate", "final_equity",
}


@dataclass(slots=True)
class OptimizationResult:
    params: dict[str, float]
    result: BacktestResult

    def as_dict(self) -> dict:
        r = self.result
        return {
            "params": self.params,
            "total_return_pct": round(r.total_return_pct, 4),
            "num_trades": r.num_trades,
            "win_rate": round(r.win_rate, 4),
            "profit_factor": (
                None if r.profit_factor == float("inf")
                else round(r.profit_factor, 4)
            ),
            "max_drawdown_pct": round(r.max_drawdown_pct, 4),
            "sharpe": round(r.sharpe, 4),
        }


def grid_search(
    base_config: TradingConfig,
    data: dict[str, Candles],
    param_grid: dict[str, list],
    *,
    sort_key: str = "sharpe",
    min_trades: int = 1,
    top_n: int | None = None,
) -> list[OptimizationResult]:
    """
    Exhaustively score every combination in ``param_grid``.

    ``param_grid`` maps :class:`TradingConfig` field names to candidate values,
    e.g. ``{"supertrend_multiplier": [2, 3, 4], "adx_threshold": [20, 25, 30]}``.
    Results are filtered to those with at least ``min_trades`` closed trades and
    sorted by ``sort_key`` (descending). Returns the top ``top_n`` (or all).
    """
    if sort_key not in _SORT_KEYS:
        raise ValueError(
            f"sort_key must be one of {sorted(_SORT_KEYS)}, got {sort_key!r}"
        )
    if not param_grid:
        raise ValueError("param_grid must not be empty")

    keys = list(param_grid)
    results: list[OptimizationResult] = []

    for combo in itertools.product(*(param_grid[k] for k in keys)):
        overrides = dict(zip(keys, combo))
        cfg = replace(base_config, **overrides)
        try:
            cfg.validate()
        except ValueError:
            continue  # skip invalid combinations (e.g. fast_ema >= slow_ema)

        result = Backtester(cfg, data).run()
        if result.num_trades < min_trades:
            continue
        results.append(OptimizationResult(params=overrides, result=result))

    results.sort(key=lambda o: getattr(o.result, sort_key), reverse=True)
    return results[:top_n] if top_n else results
