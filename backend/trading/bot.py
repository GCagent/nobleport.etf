"""
OctaStackTrader — Engine

The OctaStack engine ties the strategy, risk model, market-data feed and broker
together. It manages up to ``MAX_POSITIONS`` (the "8 stack") concurrent long
positions across the configured symbols, opening on EMA-crossover buy signals
and exiting on stop-loss, the take-profit ladder (e.g. half at +5%, rest at
+10%), or an opposing sell signal.

The engine is deterministic and side-effect-light: a single iteration is
``step()``, and ``run()`` simply loops it. This makes the whole thing testable
with a stub market-data feed and a paper broker — no network required.
"""

from __future__ import annotations

import csv
import logging
import os
import time
from datetime import datetime, timezone

from .broker import Broker, MarketData, Position, TakeProfitTier
from .config import TradingConfig
from .risk import position_size, stop_loss_price, take_profit_price
from .strategy import Signal, Strategy, build_strategy

logger = logging.getLogger(__name__)

_CSV_HEADER = [
    "timestamp", "symbol", "side", "reason",
    "entry_price", "exit_price", "quantity", "pnl_quote",
]


class OctaStackTrader:
    """Multi-symbol, 8-position EMA-crossover trading engine."""

    def __init__(
        self,
        config: TradingConfig,
        market: MarketData,
        broker: Broker,
        strategy: Strategy | None = None,
    ) -> None:
        self.cfg = config
        self.market = market
        self.broker = broker
        self.strategy = strategy or build_strategy(config)
        self.positions: dict[str, Position] = {}
        self.last_signal: dict[str, Signal] = {}
        # Optional callback invoked on every fill: fn(dict). Used by the
        # backtester to collect per-trade P&L without touching the CSV log.
        self.on_fill = None
        self._ensure_log_header()

    # ------------------------------------------------------------------ #
    # CSV trade log
    # ------------------------------------------------------------------ #
    def _ensure_log_header(self) -> None:
        path = self.cfg.log_file
        if path and not os.path.exists(path):
            try:
                with open(path, "w", newline="") as fh:
                    csv.writer(fh).writerow(_CSV_HEADER)
            except OSError as exc:  # pragma: no cover - filesystem edge case
                logger.warning("Could not create trade log %s: %s", path, exc)

    def _log_trade(self, row: list) -> None:
        if not self.cfg.log_file:
            return
        try:
            with open(self.cfg.log_file, "a", newline="") as fh:
                csv.writer(fh).writerow(row)
        except OSError as exc:  # pragma: no cover - filesystem edge case
            logger.warning("Could not write trade log: %s", exc)

    # ------------------------------------------------------------------ #
    # Position lifecycle
    # ------------------------------------------------------------------ #
    def _build_tiers(self, entry: float) -> list[TakeProfitTier]:
        return [
            TakeProfitTier(
                profit_pct=pct,
                fraction=frac,
                price=take_profit_price(entry, pct),
            )
            for pct, frac in self.cfg.take_profit_tiers
        ]

    def open_position(self, symbol: str, price: float) -> bool:
        """Open a new long position if the stack has room."""
        if symbol in self.positions:
            return False
        if len(self.positions) >= self.cfg.max_positions:
            logger.info(
                "Stack full (%d/%d) — skipping %s",
                len(self.positions), self.cfg.max_positions, symbol,
            )
            return False

        balance = self.broker.free_balance(self.cfg.quote_currency)
        qty = position_size(
            price=price,
            balance=balance,
            risk_per_trade=self.cfg.risk_per_trade,
            stop_loss_pct=self.cfg.stop_loss_pct,
            order_size_min=self.cfg.order_size_min,
        )
        if qty * price < self.cfg.order_size_min:
            logger.warning(
                "Order for %s too small (%.2f < %.2f)",
                symbol, qty * price, self.cfg.order_size_min,
            )
            return False

        if not self.broker.market_buy(symbol, qty, price):
            return False

        pos = Position(
            symbol=symbol,
            entry_price=price,
            initial_quantity=qty,
            quantity=qty,
            stop_loss=stop_loss_price(price, self.cfg.stop_loss_pct),
            tiers=self._build_tiers(price),
        )
        self.positions[symbol] = pos
        self._log_trade([
            datetime.now(timezone.utc).isoformat(), symbol, "BUY", "signal",
            f"{price:.8f}", "", f"{qty:.8f}", "",
        ])
        if self.on_fill:
            self.on_fill({
                "symbol": symbol, "side": "buy", "qty": qty,
                "price": price, "reason": "signal", "pnl": 0.0,
            })
        logger.info(
            "Opened %s: qty=%.8f entry=%.6f SL=%.6f TP=%s",
            symbol, qty, price, pos.stop_loss,
            [round(t.price, 6) for t in pos.tiers],
        )
        return True

    def _sell(self, pos: Position, qty: float, price: float, reason: str) -> None:
        if qty <= 0:
            return
        if not self.broker.market_sell(pos.symbol, qty, price):
            return
        pnl = (price - pos.entry_price) * qty
        pos.quantity -= qty
        self._log_trade([
            datetime.now(timezone.utc).isoformat(), pos.symbol, "SELL", reason,
            f"{pos.entry_price:.8f}", f"{price:.8f}", f"{qty:.8f}", f"{pnl:.2f}",
        ])
        if self.on_fill:
            self.on_fill({
                "symbol": pos.symbol, "side": "sell", "qty": qty,
                "price": price, "reason": reason, "pnl": pnl,
            })
        logger.info(
            "%s %s qty=%.8f @ %.6f pnl=%.2f %s",
            reason.upper(), pos.symbol, qty, price, pnl, self.cfg.quote_currency,
        )

    def close_position(self, symbol: str, price: float, reason: str) -> None:
        """Fully exit a position and drop it from the stack."""
        pos = self.positions.get(symbol)
        if not pos:
            return
        self._sell(pos, pos.quantity, price, reason)
        self.positions.pop(symbol, None)

    def check_exits(self) -> None:
        """Evaluate stop-loss and take-profit ladder for every open position."""
        for symbol, pos in list(self.positions.items()):
            price = self.market.fetch_price(symbol)

            # Stop-loss takes priority — exit everything.
            if price <= pos.stop_loss:
                self.close_position(symbol, price, "stop_loss")
                continue

            # Take-profit ladder: fill each armed, unfilled tier.
            for tier in pos.tiers:
                if tier.filled or price < tier.price:
                    continue
                qty = min(pos.initial_quantity * tier.fraction, pos.quantity)
                self._sell(pos, qty, price, f"take_profit_{tier.profit_pct:.0%}")
                tier.filled = True

            if not pos.is_open:
                self.positions.pop(symbol, None)

    # ------------------------------------------------------------------ #
    # Main loop
    # ------------------------------------------------------------------ #
    def step(self) -> None:
        """Run one full evaluation pass across all configured symbols."""
        for symbol in self.cfg.symbols:
            try:
                candles = self.market.fetch_ohlcv(
                    symbol, self.cfg.timeframe, limit=max(200, self.strategy.min_candles)
                )
            except Exception as exc:
                logger.error("Failed to fetch data for %s: %s", symbol, exc)
                continue

            if not candles or len(candles) == 0:
                continue

            signal = self.strategy.generate(candles)
            price = candles.close[-1]

            # De-dupe: ignore a repeat of the same actionable signal.
            if signal is not Signal.HOLD and self.last_signal.get(symbol) == signal:
                continue
            self.last_signal[symbol] = signal

            if symbol in self.positions:
                if signal is Signal.SELL:
                    self.close_position(symbol, price, "signal")
            elif signal is Signal.BUY:
                self.open_position(symbol, price)

        # Always check protective exits against the latest prices.
        self.check_exits()

        logger.info(
            "Open positions (%d/%d): %s | %s balance: %.2f",
            len(self.positions), self.cfg.max_positions,
            list(self.positions.keys()), self.cfg.quote_currency,
            self.broker.free_balance(self.cfg.quote_currency),
        )

    def run(self) -> None:
        """Loop ``step()`` forever, sleeping ``poll_interval_sec`` between passes."""
        logger.info(
            "OctaStackTrader started — up to %d positions across %s (dry_run=%s)",
            self.cfg.max_positions, self.cfg.symbols, self.cfg.dry_run,
        )
        while True:
            try:
                self.step()
                time.sleep(self.cfg.poll_interval_sec)
            except KeyboardInterrupt:
                logger.info("Stopped by user.")
                break
            except Exception as exc:  # pragma: no cover - defensive
                logger.error("Unexpected error: %s", exc, exc_info=True)
                time.sleep(min(30, self.cfg.poll_interval_sec))
