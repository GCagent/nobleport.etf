"""
OctaStackTrader — Risk Management

Position sizing and stop-loss / take-profit price math. Kept dependency-free
and side-effect-free so it can be reasoned about and unit-tested in isolation.
"""

from __future__ import annotations


def position_size(
    *,
    price: float,
    balance: float,
    risk_per_trade: float,
    stop_loss_pct: float,
    order_size_min: float,
    lot_precision: int = 8,
) -> float:
    """
    Quantity to buy so that hitting the stop loses ~``risk_per_trade`` of balance.

    risk_amount = balance * risk_per_trade
    stop_distance = price * stop_loss_pct           (loss per unit at the stop)
    quantity = risk_amount / stop_distance

    The result is then bumped up to satisfy the exchange minimum notional and
    rounded down to the lot precision.
    """
    if price <= 0:
        raise ValueError("price must be > 0")
    if stop_loss_pct <= 0:
        raise ValueError("stop_loss_pct must be > 0")

    risk_amount = balance * risk_per_trade
    stop_distance = price * stop_loss_pct
    quantity = risk_amount / stop_distance

    if quantity * price < order_size_min:
        quantity = order_size_min / price

    factor = 10 ** lot_precision
    return int(quantity * factor) / factor


def stop_loss_price(entry: float, stop_loss_pct: float) -> float:
    """Absolute stop price for a long position."""
    return entry * (1.0 - stop_loss_pct)


def take_profit_price(entry: float, profit_pct: float) -> float:
    """Absolute take-profit price for a given gain above entry."""
    return entry * (1.0 + profit_pct)
