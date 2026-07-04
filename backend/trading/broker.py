"""
OctaStackTrader — Brokers, Positions & Market Data

This module separates two concerns the original single-file draft conflated:

  * **Market data** (read-only price/candle feeds) — always real, even in
    paper mode, because paper trading should react to live prices.
  * **Order execution** — either simulated (``PaperBroker``) or real
    (``CCXTBroker``).

``ccxt`` is imported lazily inside the live implementations so the strategy /
paper-trading core runs with zero third-party dependencies.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Position
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class Candles:
    """OHLCV history for one symbol, column-oriented for indicator math."""

    timestamp: list[int] = field(default_factory=list)
    open: list[float] = field(default_factory=list)
    high: list[float] = field(default_factory=list)
    low: list[float] = field(default_factory=list)
    close: list[float] = field(default_factory=list)
    volume: list[float] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.close)

    @classmethod
    def from_ccxt(cls, rows: list[list[float]]) -> "Candles":
        """Build from ccxt ``fetch_ohlcv`` rows ``[ts, o, h, l, c, v]``."""
        c = cls()
        for ts, o, h, lo, cl, v in rows:
            c.timestamp.append(int(ts))
            c.open.append(float(o))
            c.high.append(float(h))
            c.low.append(float(lo))
            c.close.append(float(cl))
            c.volume.append(float(v))
        return c


@dataclass(slots=True)
class TakeProfitTier:
    """A single rung of the take-profit ladder."""

    profit_pct: float          # gain above entry that arms this tier
    fraction: float            # portion of the ORIGINAL size to sell here
    price: float               # absolute trigger price
    filled: bool = False


@dataclass(slots=True)
class Position:
    """An open long position with a stop and a take-profit ladder."""

    symbol: str
    entry_price: float
    initial_quantity: float
    quantity: float            # remaining (un-sold) quantity
    stop_loss: float
    tiers: list[TakeProfitTier] = field(default_factory=list)
    open_time: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def is_open(self) -> bool:
        return self.quantity > 1e-12

    def unrealized_pct(self, price: float) -> float:
        return (price - self.entry_price) / self.entry_price


# --------------------------------------------------------------------------- #
# Market data
# --------------------------------------------------------------------------- #
class MarketData(ABC):
    """Read-only price / OHLCV feed."""

    @abstractmethod
    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> Candles:
        ...

    @abstractmethod
    def fetch_price(self, symbol: str) -> float:
        ...


# --------------------------------------------------------------------------- #
# Broker
# --------------------------------------------------------------------------- #
class Broker(ABC):
    """Order-execution + balance interface."""

    @abstractmethod
    def free_balance(self, currency: str) -> float:
        ...

    @abstractmethod
    def market_buy(self, symbol: str, quantity: float, price: float) -> bool:
        ...

    @abstractmethod
    def market_sell(self, symbol: str, quantity: float, price: float) -> bool:
        ...


# --------------------------------------------------------------------------- #
# Paper broker (simulation)
# --------------------------------------------------------------------------- #
class PaperBroker(Broker):
    """In-memory simulated broker tracking quote + base balances."""

    def __init__(self, *, quote_currency: str, starting_balance: float) -> None:
        self.quote_currency = quote_currency
        self.balances: dict[str, float] = {quote_currency: starting_balance}

    def free_balance(self, currency: str) -> float:
        return self.balances.get(currency, 0.0)

    def market_buy(self, symbol: str, quantity: float, price: float) -> bool:
        base, quote = symbol.split("/")
        cost = quantity * price
        if self.balances.get(quote, 0.0) + 1e-9 < cost:
            logger.error("Insufficient paper %s for %s buy", quote, symbol)
            return False
        self.balances[quote] = self.balances.get(quote, 0.0) - cost
        self.balances[base] = self.balances.get(base, 0.0) + quantity
        logger.info(
            "PAPER BUY %s %s @ %.6f (cost %.2f %s)",
            quantity, base, price, cost, quote,
        )
        return True

    def market_sell(self, symbol: str, quantity: float, price: float) -> bool:
        base, quote = symbol.split("/")
        if self.balances.get(base, 0.0) + 1e-9 < quantity:
            logger.error("Insufficient paper %s for %s sell", base, symbol)
            return False
        revenue = quantity * price
        self.balances[base] = self.balances.get(base, 0.0) - quantity
        self.balances[quote] = self.balances.get(quote, 0.0) + revenue
        logger.info(
            "PAPER SELL %s %s @ %.6f (revenue %.2f %s)",
            quantity, base, price, revenue, quote,
        )
        return True


# --------------------------------------------------------------------------- #
# CCXT-backed live implementations (lazy import)
# --------------------------------------------------------------------------- #
def _build_ccxt_exchange(
    *,
    exchange: str,
    api_key: str | None,
    api_secret: str | None,
    testnet: bool,
):  # pragma: no cover - requires network + ccxt
    import ccxt  # lazy

    klass = getattr(ccxt, exchange)
    client = klass(
        {
            "apiKey": api_key,
            "secret": api_secret,
            "enableRateLimit": True,
            "options": {"defaultType": "spot"},
        }
    )
    if testnet:
        client.set_sandbox_mode(True)
        logger.info("Using %s TESTNET", exchange)
    else:
        logger.warning("Using %s LIVE — real funds at risk", exchange)
    return client


class CCXTMarketData(MarketData):  # pragma: no cover - requires network
    """Real OHLCV / ticker feed via ccxt (used in both paper and live modes)."""

    def __init__(self, client) -> None:
        self.client = client

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> Candles:
        rows = self.client.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
        return Candles.from_ccxt(rows)

    def fetch_price(self, symbol: str) -> float:
        return float(self.client.fetch_ticker(symbol)["last"])


class CCXTBroker(Broker):  # pragma: no cover - requires network
    """Live order execution via ccxt."""

    def __init__(self, client, *, quote_currency: str) -> None:
        self.client = client
        self.quote_currency = quote_currency

    def free_balance(self, currency: str) -> float:
        return float(self.client.fetch_balance()["free"].get(currency, 0.0))

    def market_buy(self, symbol: str, quantity: float, price: float) -> bool:
        try:
            order = self.client.create_market_buy_order(symbol, quantity)
            logger.info("LIVE BUY filled: %s", order.get("id", order))
            return True
        except Exception as exc:
            logger.error("Live buy failed for %s: %s", symbol, exc)
            return False

    def market_sell(self, symbol: str, quantity: float, price: float) -> bool:
        try:
            order = self.client.create_market_sell_order(symbol, quantity)
            logger.info("LIVE SELL filled: %s", order.get("id", order))
            return True
        except Exception as exc:
            logger.error("Live sell failed for %s: %s", symbol, exc)
            return False
