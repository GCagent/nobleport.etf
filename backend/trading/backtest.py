"""
OctaStackTrader — Backtesting Engine

Replays historical OHLCV through the *real* :class:`OctaStackTrader` engine, so
backtests exercise exactly the same 8-stack limit, position sizing, stop-loss
and take-profit-ladder logic as live/paper trading — no separate simulation to
drift out of sync.

This is the component an MCP backtesting server (David's optimization loop)
would call to score a parameter set: feed it candles + a config, get back
Sharpe, win rate, max drawdown, etc.
"""

from __future__ import annotations

import logging
import math
from contextlib import contextmanager
from dataclasses import dataclass, field

from .bot import OctaStackTrader
from .broker import Candles, MarketData, PaperBroker
from .config import TradingConfig
from .strategy import Strategy, build_strategy


@contextmanager
def _quiet_engine_logs():
    """Silence the engine's per-bar INFO/trade logs during a backtest run."""
    pkg_logger = logging.getLogger("backend.trading")
    previous = pkg_logger.level
    pkg_logger.setLevel(logging.WARNING)
    try:
        yield
    finally:
        pkg_logger.setLevel(previous)


class _ReplayMarketData(MarketData):
    """Serves history up to a moving cursor; ``index`` is the current bar."""

    def __init__(self, data: dict[str, Candles]) -> None:
        self.data = data
        self.index = 0

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> Candles:
        full = self.data[symbol]
        end = self.index + 1
        start = max(0, end - limit)
        return Candles(
            timestamp=full.timestamp[start:end],
            open=full.open[start:end],
            high=full.high[start:end],
            low=full.low[start:end],
            close=full.close[start:end],
            volume=full.volume[start:end],
        )

    def fetch_price(self, symbol: str) -> float:
        return self.data[symbol].close[self.index]


@dataclass(slots=True)
class BacktestResult:
    initial_equity: float
    final_equity: float
    total_return_pct: float
    num_trades: int          # closed (sell) fills
    win_rate: float
    avg_win: float
    avg_loss: float
    profit_factor: float
    max_drawdown_pct: float
    sharpe: float
    equity_curve: list[float] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"return={self.total_return_pct:+.2f}%  trades={self.num_trades}  "
            f"win_rate={self.win_rate:.1%}  profit_factor={self.profit_factor:.2f}  "
            f"max_dd={self.max_drawdown_pct:.2f}%  sharpe={self.sharpe:.2f}"
        )


class Backtester:
    """Run a strategy/config over historical candles and score it."""

    def __init__(
        self,
        config: TradingConfig,
        data: dict[str, Candles],
        strategy: Strategy | None = None,
    ) -> None:
        if not data:
            raise ValueError("backtest needs at least one symbol of candle data")
        self.cfg = config
        self.data = data
        self.strategy = strategy or build_strategy(config)
        self._market = _ReplayMarketData(data)
        self._broker = PaperBroker(
            quote_currency=config.quote_currency,
            starting_balance=config.starting_paper_balance,
        )
        self.engine = OctaStackTrader(
            config, self._market, self._broker, strategy=self.strategy
        )

    # ------------------------------------------------------------------ #
    def _mark_to_market(self) -> float:
        """Total equity = quote balance + value of all held base assets."""
        equity = self._broker.free_balance(self.cfg.quote_currency)
        for symbol in self.data:
            base = symbol.split("/")[0]
            qty = self._broker.free_balance(base)
            if qty:
                equity += qty * self._market.fetch_price(symbol)
        return equity

    def run(self) -> BacktestResult:
        realized: list[float] = []
        self.engine.on_fill = lambda fill: (
            realized.append(fill["pnl"]) if fill["side"] == "sell" else None
        )

        n = min(len(c) for c in self.data.values())
        start = min(self.strategy.min_candles, n)
        initial_equity = self.cfg.starting_paper_balance
        equity_curve: list[float] = []

        with _quiet_engine_logs():
            for t in range(start, n):
                self._market.index = t
                self.engine.step()
                equity_curve.append(self._mark_to_market())

            # Force-close anything still open at the final bar.
            self._market.index = n - 1
            for symbol in list(self.engine.positions):
                self.engine.close_position(
                    symbol, self._market.fetch_price(symbol), "backtest_end"
                )
        final_equity = self._mark_to_market()
        equity_curve.append(final_equity)

        return self._score(initial_equity, final_equity, realized, equity_curve)

    # ------------------------------------------------------------------ #
    @staticmethod
    def _score(
        initial: float,
        final: float,
        realized: list[float],
        curve: list[float],
    ) -> BacktestResult:
        wins = [p for p in realized if p > 0]
        losses = [p for p in realized if p < 0]
        gross_win = sum(wins)
        gross_loss = -sum(losses)
        profit_factor = (
            gross_win / gross_loss if gross_loss > 0
            else (float("inf") if gross_win > 0 else 0.0)
        )

        # Sharpe from per-bar equity returns (not annualised).
        returns: list[float] = []
        for i in range(1, len(curve)):
            prev = curve[i - 1]
            if prev > 0:
                returns.append((curve[i] - prev) / prev)
        sharpe = 0.0
        if len(returns) > 1:
            mean = sum(returns) / len(returns)
            var = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
            std = math.sqrt(var)
            if std > 0:
                sharpe = mean / std * math.sqrt(len(returns))

        # Max drawdown over the equity curve.
        peak = curve[0] if curve else initial
        max_dd = 0.0
        for v in curve:
            peak = max(peak, v)
            if peak > 0:
                max_dd = max(max_dd, (peak - v) / peak)

        return BacktestResult(
            initial_equity=initial,
            final_equity=final,
            total_return_pct=(final / initial - 1.0) * 100.0 if initial else 0.0,
            num_trades=len(realized),
            win_rate=len(wins) / len(realized) if realized else 0.0,
            avg_win=gross_win / len(wins) if wins else 0.0,
            avg_loss=-gross_loss / len(losses) if losses else 0.0,
            profit_factor=profit_factor,
            max_drawdown_pct=max_dd * 100.0,
            sharpe=sharpe,
            equity_curve=curve,
        )
