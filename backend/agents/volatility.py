"""
Agent 3 – Implied Volatility
============================
Tools registered:
  • compute_implied_volatility
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from config import RISK_FREE_RATE
from utils.bs_math import implied_volatility
from utils.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)

# Constants
DAYS_PER_YEAR = 365.25
MIN_T_YEARS = 0.001
DEFAULT_FALLBACK_IV = 0.30
MAX_RISK_FREE_RATE = 1.0
MIN_RISK_FREE_RATE = 0.0


def _years_to_expiry(expiry: str) -> float:
    """
    Calculate years to expiry from date string YYYY-MM-DD.
    
    Args:
        expiry: Date string in YYYY-MM-DD format
        
    Returns:
        Years to expiry as float, minimum 0.001
        
    Raises:
        ValueError: If expiry date is invalid or in the past
    """
    try:
        today = datetime.utcnow().date()  # Use UTC for consistency
        target = datetime.strptime(expiry, "%Y-%m-%d").date()
        days = (target - today).days
        
        if days < 0:
            raise ValueError(f"Expiry date {expiry} is in the past")
        
        years = days / DAYS_PER_YEAR
        return max(years, MIN_T_YEARS)
        
    except ValueError as e:
        logger.error(f"Error parsing expiry {expiry}: {e}")
        raise ValueError(f"Invalid expiry date format. Expected YYYY-MM-DD, got {expiry}") from e


def _validate_option_type(option_type: str) -> None:
    """Validate option type parameter."""
    if option_type not in ("call", "put"):
        raise ValueError(f"option_type must be 'call' or 'put', got '{option_type}'")


def _validate_risk_free_rate(rate: float) -> None:
    """Validate risk-free rate parameter."""
    if not MIN_RISK_FREE_RATE <= rate <= MAX_RISK_FREE_RATE:
        raise ValueError(
            f"risk_free_rate must be between {MIN_RISK_FREE_RATE} and {MAX_RISK_FREE_RATE}, "
            f"got {rate}"
        )


def _validate_positive(name: str, value: float, allow_zero: bool = False) -> None:
    """Validate positive numeric values."""
    if allow_zero:
        if value < 0:
            raise ValueError(f"{name} must be >= 0, got {value}")
    else:
        if value <= 0:
            raise ValueError(f"{name} must be > 0, got {value}")


def _create_error_response(
    error: str,
    market_price: Optional[float] = None,
    spot_price: Optional[float] = None,
    strike: Optional[float] = None,
    expiry: Optional[str] = None,
    option_type: str = "call",
) -> dict:
    """Create standardized error response."""
    response = {
        "implied_volatility": None,
        "iv_valid": False,
        "error": error,
        "option_type": option_type,
    }
    
    # Include input values if available for debugging
    if market_price is not None:
        response["market_price"] = market_price
    if spot_price is not None:
        response["spot_price"] = spot_price
    if strike is not None:
        response["strike"] = strike
    if expiry is not None:
        response["expiry"] = expiry
        
    return response


def _compute_implied_volatility(
    market_price: float,
    spot_price: float,
    strike: float,
    expiry: str,
    option_type: str = "call",
    risk_free_rate: float = RISK_FREE_RATE,
) -> dict:
    """
    Compute implied volatility from market price using Black-Scholes model.
    
    Args:
        market_price: Current market price of the option
        spot_price: Current spot price of the underlying asset
        strike: Strike price of the option
        expiry: Expiry date in YYYY-MM-DD format
        option_type: Type of option - "call" or "put"
        risk_free_rate: Risk-free interest rate (default from config)
        
    Returns:
        Dictionary containing:
            - implied_volatility: Computed IV (or None if calculation fails)
            - iv_valid: Boolean indicating if IV is valid
            - market_price, spot_price, strike, expiry, T_years, option_type
            - error: Error message if calculation failed
    """
    
    try:
        # Validate inputs
        _validate_positive("market_price", market_price)
        _validate_positive("spot_price", spot_price)
        _validate_positive("strike", strike)
        _validate_option_type(option_type)
        _validate_risk_free_rate(risk_free_rate)
        
        # Calculate time to expiry
        T = _years_to_expiry(expiry)
        
        # Calculate IV using Black-Scholes solver
        iv = implied_volatility(
            market_price, spot_price, strike, T, risk_free_rate, option_type
        )
        
        # Check if IV calculation succeeded
        if iv is None or iv <= 0:
            logger.warning(
                f"IV solver failed to converge: "
                f"market_price={market_price:.4f}, spot={spot_price:.2f}, "
                f"strike={strike:.2f}, T={T:.4f}, type={option_type}"
            )
            return _create_error_response(
                error="IV solver failed to converge",
                market_price=market_price,
                spot_price=spot_price,
                strike=strike,
                expiry=expiry,
                option_type=option_type,
            )
        
        # Check for unrealistic IV values
        if iv > 5.0:  # 500% IV is unrealistic
            logger.warning(f"Implausibly high IV: {iv:.2%}")
            
        return {
            "implied_volatility": round(iv, 6),
            "iv_valid": True,
            "market_price": round(market_price, 4),
            "spot_price": round(spot_price, 4),
            "strike": round(strike, 2),
            "expiry": expiry,
            "T_years": round(T, 6),
            "option_type": option_type,
            "error": None,
        }
        
    except ValueError as e:
        logger.warning(f"Input validation error: {e}")
        return _create_error_response(
            error=str(e),
            market_price=market_price,
            spot_price=spot_price,
            strike=strike,
            expiry=expiry,
            option_type=option_type,
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in IV calculation: {e}", exc_info=True)
        return _create_error_response(
            error=f"Unexpected error: {str(e)}",
            market_price=market_price,
            spot_price=spot_price,
            strike=strike,
            expiry=expiry,
            option_type=option_type,
        )


def register(registry: ToolRegistry) -> None:
    """Register the compute_implied_volatility tool with the registry."""
    registry.register(
        "compute_implied_volatility",
        _compute_implied_volatility,
        description="Reverse-solve Black-Scholes to find implied volatility from a market price.",
    )