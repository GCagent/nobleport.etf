"""
OctaStackTrader — Signal Strategies

Pluggable strategies that map an OHLCV :class:`~backend.trading.broker.Candles`
window to a :class:`Signal`:

  * ``EmaCrossoverStrategy`` — 10/30 EMA crossover with an RSI filter.
  * ``SupertrendAdxStrategy`` — SuperTrend direction gated by ADX trend
    strength ("David's approach": go long when SuperTrend flips up and the
    trend is strong; exit when it flips down).

Both expose the same ``generate(candles)`` / ``min_candles`` interface, so the
engine and backtester are strategy-agnostic.
"""

from __future__ import annotations

from enum import Enum
from typing import Protocol, runtime_checkable

from .broker import Candles
from .indicators import adx, ema, rsi, supertrend


class Signal(str, Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


@runtime_checkable
class Strategy(Protocol):
    """Structural type implemented by every strategy."""

    min_candles: int

    def generate(self, candles: Candles) -> Signal:
        ...


class EmaCrossoverStrategy:
    """EMA-crossover strategy with an RSI filter."""

    def __init__(
        self,
        *,
        fast_ema: int = 10,
        slow_ema: int = 30,
        rsi_period: int = 14,
        rsi_overbought: float = 70.0,
        rsi_oversold: float = 30.0,
    ) -> None:
        if fast_ema >= slow_ema:
            raise ValueError("fast_ema must be < slow_ema")
        self.fast_ema = fast_ema
        self.slow_ema = slow_ema
        self.rsi_period = rsi_period
        self.rsi_overbought = rsi_overbought
        self.rsi_oversold = rsi_oversold

    @property
    def min_candles(self) -> int:
        return self.slow_ema + 2

    def generate(self, candles: Candles) -> Signal:
        closes = candles.close
        if len(closes) < self.min_candles:
            return Signal.HOLD

        fast = ema(closes, self.fast_ema)
        slow = ema(closes, self.slow_ema)
        rsi_vals = rsi(closes, self.rsi_period)

        f_now, f_prev = fast[-1], fast[-2]
        s_now, s_prev = slow[-1], slow[-2]
        if None in (f_now, f_prev, s_now, s_prev):
            return Signal.HOLD

        r = rsi_vals[-1] if rsi_vals[-1] is not None else 50.0
        crossed_up = f_prev <= s_prev and f_now > s_now
        crossed_down = f_prev >= s_prev and f_now < s_now

        if crossed_up and r < self.rsi_overbought:
            return Signal.BUY
        if crossed_down and r > self.rsi_oversold:
            return Signal.SELL
        return Signal.HOLD


class SupertrendAdxStrategy:
    """
    SuperTrend + ADX trend-following strategy.

    BUY  when SuperTrend flips from down→up on the latest bar and ADX > threshold.
    SELL when SuperTrend flips from up→down (regardless of ADX — exits should be
         responsive). Otherwise HOLD.
    """

    def __init__(
        self,
        *,
        supertrend_period: int = 10,
        supertrend_multiplier: float = 3.0,
        adx_period: int = 14,
        adx_threshold: float = 25.0,
    ) -> None:
        self.supertrend_period = supertrend_period
        self.supertrend_multiplier = supertrend_multiplier
        self.adx_period = adx_period
        self.adx_threshold = adx_threshold

    @property
    def min_candles(self) -> int:
        # ADX needs ~2*period to warm up; SuperTrend needs its period.
        return max(self.supertrend_period, 2 * self.adx_period) + 2

    def generate(self, candles: Candles) -> Signal:
        if len(candles) < self.min_candles:
            return Signal.HOLD

        st = supertrend(
            candles.high, candles.low, candles.close,
            self.supertrend_period, self.supertrend_multiplier,
        )
        adx_vals = adx(candles.high, candles.low, candles.close, self.adx_period)

        st_now, st_prev = st[-1], st[-2]
        if st_now is None or st_prev is None:
            return Signal.HOLD
        a = adx_vals[-1]

        flipped_up = st_prev == -1 and st_now == 1
        flipped_down = st_prev == 1 and st_now == -1

        if flipped_up and a is not None and a > self.adx_threshold:
            return Signal.BUY
        if flipped_down:
            return Signal.SELL
        return Signal.HOLD


def build_strategy(cfg) -> Strategy:
    """Construct the strategy named by ``cfg.strategy``."""
    name = getattr(cfg, "strategy", "ema").lower()
    if name in ("ema", "ema_crossover"):
        return EmaCrossoverStrategy(
            fast_ema=cfg.fast_ema,
            slow_ema=cfg.slow_ema,
            rsi_period=cfg.rsi_period,
            rsi_overbought=cfg.rsi_overbought,
            rsi_oversold=cfg.rsi_oversold,
        )
    if name in ("supertrend_adx", "supertrend", "st_adx"):
        return SupertrendAdxStrategy(
            supertrend_period=cfg.supertrend_period,
            supertrend_multiplier=cfg.supertrend_multiplier,
            adx_period=cfg.adx_period,
            adx_threshold=cfg.adx_threshold,
        )
    raise ValueError(f"unknown strategy: {cfg.strategy!r}")
