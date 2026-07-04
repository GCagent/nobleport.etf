"""
OctaStackTrader — Technical Indicators

Pure-Python indicator implementations so the strategy core has no hard
dependency on pandas/numpy and can run (and be unit-tested) anywhere.
Each function takes a list of closing prices and returns a list aligned to
the input, with ``None`` for leading positions that have insufficient data.
"""

from __future__ import annotations


def ema(values: list[float], period: int) -> list[float | None]:
    """
    Exponential Moving Average.

    Seeded with a simple moving average over the first ``period`` values, then
    smoothed with ``alpha = 2 / (period + 1)``. Positions before the seed are
    ``None``.
    """
    if period <= 0:
        raise ValueError("period must be > 0")
    n = len(values)
    out: list[float | None] = [None] * n
    if n < period:
        return out

    alpha = 2.0 / (period + 1.0)
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    prev = seed
    for i in range(period, n):
        prev = (values[i] - prev) * alpha + prev
        out[i] = prev
    return out


def rsi(values: list[float], period: int) -> list[float | None]:
    """
    Relative Strength Index using Wilder's smoothing.

    Returns values in ``[0, 100]``; leading positions without enough data are
    ``None``. A zero average-loss yields an RSI of 100 (pure uptrend).
    """
    if period <= 0:
        raise ValueError("period must be > 0")
    n = len(values)
    out: list[float | None] = [None] * n
    if n <= period:
        return out

    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        delta = values[i] - values[i - 1]
        if delta >= 0:
            gains += delta
        else:
            losses -= delta
    avg_gain = gains / period
    avg_loss = losses / period
    out[period] = _rsi_from_avgs(avg_gain, avg_loss)

    for i in range(period + 1, n):
        delta = values[i] - values[i - 1]
        gain = delta if delta > 0 else 0.0
        loss = -delta if delta < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        out[i] = _rsi_from_avgs(avg_gain, avg_loss)
    return out


def _rsi_from_avgs(avg_gain: float, avg_loss: float) -> float:
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _true_ranges(high: list[float], low: list[float], close: list[float]) -> list[float]:
    """True Range series; index 0 is just high-low (no prior close)."""
    n = len(close)
    tr: list[float] = [0.0] * n
    if n == 0:
        return tr
    tr[0] = high[0] - low[0]
    for i in range(1, n):
        tr[i] = max(
            high[i] - low[i],
            abs(high[i] - close[i - 1]),
            abs(low[i] - close[i - 1]),
        )
    return tr


def atr(
    high: list[float], low: list[float], close: list[float], period: int
) -> list[float | None]:
    """Average True Range (Wilder's smoothing)."""
    n = len(close)
    out: list[float | None] = [None] * n
    if n <= period:
        return out
    tr = _true_ranges(high, low, close)
    prev = sum(tr[1 : period + 1]) / period
    out[period] = prev
    for i in range(period + 1, n):
        prev = (prev * (period - 1) + tr[i]) / period
        out[i] = prev
    return out


def supertrend(
    high: list[float],
    low: list[float],
    close: list[float],
    period: int = 10,
    multiplier: float = 3.0,
) -> list[int | None]:
    """
    SuperTrend direction: ``1`` = uptrend (bullish), ``-1`` = downtrend.

    Returns ``None`` until the ATR has warmed up. Implements the standard
    band-locking logic used by the TradingView SuperTrend indicator.
    """
    n = len(close)
    out: list[int | None] = [None] * n
    atr_vals = atr(high, low, close, period)

    final_upper = 0.0
    final_lower = 0.0
    direction = 1
    started = False
    for i in range(n):
        a = atr_vals[i]
        if a is None:
            continue
        mid = (high[i] + low[i]) / 2.0
        basic_upper = mid + multiplier * a
        basic_lower = mid - multiplier * a

        if not started:
            final_upper = basic_upper
            final_lower = basic_lower
            direction = 1 if close[i] >= mid else -1
            out[i] = direction
            started = True
            continue

        final_upper = (
            basic_upper
            if (basic_upper < final_upper or close[i - 1] > final_upper)
            else final_upper
        )
        final_lower = (
            basic_lower
            if (basic_lower > final_lower or close[i - 1] < final_lower)
            else final_lower
        )

        if close[i] > final_upper:
            direction = 1
        elif close[i] < final_lower:
            direction = -1
        # else: direction unchanged
        out[i] = direction
    return out


def adx(
    high: list[float], low: list[float], close: list[float], period: int = 14
) -> list[float | None]:
    """Average Directional Index (trend strength), Wilder's smoothing."""
    n = len(close)
    out: list[float | None] = [None] * n
    if n <= 2 * period:
        return out

    tr = _true_ranges(high, low, close)
    plus_dm = [0.0] * n
    minus_dm = [0.0] * n
    for i in range(1, n):
        up = high[i] - high[i - 1]
        down = low[i - 1] - low[i]
        plus_dm[i] = up if (up > down and up > 0) else 0.0
        minus_dm[i] = down if (down > up and down > 0) else 0.0

    # Wilder-smoothed sums seeded over the first `period` increments.
    atr_s = sum(tr[1 : period + 1])
    plus_s = sum(plus_dm[1 : period + 1])
    minus_s = sum(minus_dm[1 : period + 1])

    dx_vals: list[float] = []
    for i in range(period + 1, n):
        atr_s = atr_s - atr_s / period + tr[i]
        plus_s = plus_s - plus_s / period + plus_dm[i]
        minus_s = minus_s - minus_s / period + minus_dm[i]
        plus_di = 100.0 * plus_s / atr_s if atr_s else 0.0
        minus_di = 100.0 * minus_s / atr_s if atr_s else 0.0
        denom = plus_di + minus_di
        dx = 100.0 * abs(plus_di - minus_di) / denom if denom else 0.0
        dx_vals.append(dx)
        idx = i  # position in original series this dx corresponds to
        if len(dx_vals) == period:
            out[idx] = sum(dx_vals) / period
        elif len(dx_vals) > period:
            out[idx] = (out[idx - 1] * (period - 1) + dx) / period
    return out
