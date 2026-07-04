"""
OctaStackTrader — MCP Backtesting Server

A Model Context Protocol server that exposes the OctaStack backtester and
optimizer as tools, so Claude can run the automated optimization loop:

    Claude  ──run_backtest / optimize──▶  MCP Server  ──▶  Backtester
                       ▲                                        │
                       └────────────  metrics  ◀───────────────┘

Tools
-----
- ``download_ohlcv`` : fetch + cache historical candles from an exchange (Bybit…)
- ``run_backtest``   : score one strategy/parameter set, return metrics
- ``optimize``       : grid-search parameters, return ranked metrics

Run it with::

    pip install "mcp[cli]" ccxt
    python -m backend.trading.mcp_server

``mcp`` is imported lazily so the rest of the trading package (and its tests)
have no dependency on it.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from .backtest import Backtester
from .config import TradingConfig
from .data import download_history, load_dataset
from .optimize import grid_search


def _make_config(
    *,
    strategy: str,
    timeframe: str,
    symbols: list[str],
    starting_balance: float,
    params: dict[str, Any] | None,
) -> TradingConfig:
    cfg = TradingConfig(
        symbols=symbols,
        strategy=strategy,
        timeframe=timeframe,
        starting_paper_balance=starting_balance,
        log_file="",  # never write CSVs during backtests
    )
    if params:
        cfg = replace(cfg, **params)
    cfg.validate()
    return cfg


def run_backtest(
    data_paths: dict[str, str],
    strategy: str = "supertrend_adx",
    timeframe: str = "4h",
    starting_balance: float = 10_000.0,
    params: dict[str, Any] | None = None,
) -> dict:
    """
    Backtest one strategy/parameter set and return performance metrics.

    ``data_paths`` maps each symbol to a CSV/JSON candle file
    (e.g. ``{"BTC/USDT": "data/btc_4h.csv"}``). ``params`` may override any
    TradingConfig field (``supertrend_multiplier``, ``adx_threshold``,
    ``stop_loss_pct``, ``risk_per_trade``, ...).
    """
    data = load_dataset(data_paths)
    cfg = _make_config(
        strategy=strategy, timeframe=timeframe, symbols=list(data),
        starting_balance=starting_balance, params=params,
    )
    result = Backtester(cfg, data).run()
    return {
        "strategy": strategy,
        "params": params or {},
        "summary": result.summary(),
        "total_return_pct": round(result.total_return_pct, 4),
        "num_trades": result.num_trades,
        "win_rate": round(result.win_rate, 4),
        "profit_factor": (
            None if result.profit_factor == float("inf")
            else round(result.profit_factor, 4)
        ),
        "max_drawdown_pct": round(result.max_drawdown_pct, 4),
        "sharpe": round(result.sharpe, 4),
        "final_equity": round(result.final_equity, 2),
    }


def optimize(
    data_paths: dict[str, str],
    param_grid: dict[str, list],
    strategy: str = "supertrend_adx",
    timeframe: str = "4h",
    starting_balance: float = 10_000.0,
    sort_key: str = "sharpe",
    top_n: int = 10,
    min_trades: int = 1,
) -> list[dict]:
    """
    Grid-search ``param_grid`` and return the top ``top_n`` ranked by ``sort_key``.

    Example ``param_grid``::

        {"supertrend_multiplier": [2, 3, 4], "adx_threshold": [20, 25, 30]}
    """
    data = load_dataset(data_paths)
    base = _make_config(
        strategy=strategy, timeframe=timeframe, symbols=list(data),
        starting_balance=starting_balance, params=None,
    )
    ranked = grid_search(
        base, data, param_grid,
        sort_key=sort_key, min_trades=min_trades, top_n=top_n,
    )
    return [o.as_dict() for o in ranked]


def download_ohlcv(  # pragma: no cover - requires network + ccxt
    exchange: str,
    symbol: str,
    out_path: str,
    timeframe: str = "4h",
    limit: int = 1000,
    testnet: bool = False,
) -> dict:
    """Download OHLCV from an exchange and cache it to ``out_path`` (CSV)."""
    candles = download_history(
        exchange=exchange, symbol=symbol, timeframe=timeframe,
        limit=limit, out_path=out_path, testnet=testnet,
    )
    return {"symbol": symbol, "candles": len(candles), "path": out_path}


def build_server():  # pragma: no cover - requires the mcp package
    """Construct the FastMCP server with all tools registered."""
    from mcp.server.fastmcp import FastMCP

    server = FastMCP("octastack-trader")
    server.tool()(run_backtest)
    server.tool()(optimize)
    server.tool()(download_ohlcv)
    return server


def main() -> None:  # pragma: no cover - requires the mcp package
    build_server().run()


if __name__ == "__main__":  # pragma: no cover
    main()
