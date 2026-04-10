"""
Payoff Diagram
==============
Profit / Loss at expiry for a single-leg option position.
Supports long/short × call/put combinations.
Also overlays the current BS theoretical P&L (before expiry) using BS pricing.
"""
from __future__ import annotations

import numpy as np
import plotly.graph_objects as go

from utils.bs_math import bs_price as _bs_price, bs_greeks as _bs_greeks


def payoff_diagram(
    strike: float,
    premium_paid: float,          # positive = bought, negative = sold (net credit)
    option_type: str = "call",    # "call" | "put"
    position: str = "long",       # "long" | "short"
    spot: float | None = None,
    T_years: float | None = None,
    r: float = 0.045,
    sigma: float | None = None,
    ticker: str = "",
    expiry: str = "",
    n_points: int = 300,
) -> go.Figure:
    """
    Parameters
    ----------
    strike        : option strike price
    premium_paid  : cost of the option (positive number; direction set by `position`)
    option_type   : "call" or "put"
    position      : "long" (bought) or "short" (sold)
    spot          : current spot price – used to centre the x-axis
    T_years       : time to expiry in years (for pre-expiry BS curve)
    r             : risk-free rate
    sigma         : implied / historical vol (for pre-expiry curve)
    ticker, expiry: labels only
    """
    centre   = spot if spot else strike
    x_lo     = centre * 0.55
    x_hi     = centre * 1.45
    spots    = np.linspace(x_lo, x_hi, n_points)

    sign = 1 if position == "long" else -1   # long pays premium, short receives it

    # ── Expiry P&L ────────────────────────────────────────────────────────────
    if option_type == "call":
        intrinsic = np.maximum(spots - strike, 0.0)
    else:
        intrinsic = np.maximum(strike - spots, 0.0)

    # long:  receive intrinsic − premium paid
    # short: receive premium − intrinsic
    pnl_expiry = sign * (intrinsic - premium_paid)

    # ── Pre-expiry BS P&L (if vol + T supplied) ───────────────────────────────
    pnl_now = None
    if T_years and T_years > 0 and sigma and sigma > 0:
        bs_vals  = np.array([_bs_price(S, strike, T_years, r, sigma, option_type) for S in spots])
        # cost basis = current BS price ≈ premium_paid for long
        # For display purposes anchor at premium_paid
        pnl_now  = sign * (bs_vals - premium_paid)

    # ── Breakeven(s) ──────────────────────────────────────────────────────────
    if option_type == "call":
        be = strike + premium_paid
    else:
        be = strike - premium_paid
    # For short, breakeven is flipped sign-wise but same price point
    be_label = f"BE = ${be:.2f}"

    # ── Greeks annotation ─────────────────────────────────────────────────────
    greek_text = ""
    if spot and T_years and sigma:
        g = _bs_greeks(spot, strike, T_years, r, sigma, option_type)
        greek_text = (
            f"Δ {g['delta']:+.3f}  |  Γ {g['gamma']:.4f}  |  "
            f"ν {g['vega']:.4f}  |  Θ {g['theta']:+.4f}"
        )

    # ── Colour scheme ────────────────────────────────────────────────────────
    profit_color = "#81C784"   # green
    loss_color   = "#E57373"   # red
    now_color    = "#FFD54F"   # amber – pre-expiry curve

    # Split expiry P&L into profit / loss segments for fill colouring
    pnl_profit = np.where(pnl_expiry >= 0, pnl_expiry, np.nan)
    pnl_loss   = np.where(pnl_expiry <  0, pnl_expiry, np.nan)

    fig = go.Figure()

    # Zero axis
    fig.add_hline(y=0, line_color="rgba(255,255,255,0.25)", line_width=1)

    # Profit fill
    fig.add_trace(go.Scatter(
        x=np.concatenate([spots, spots[::-1]]),
        y=np.concatenate([
            np.where(pnl_expiry >= 0, pnl_expiry, 0),
            np.zeros(n_points),
        ]),
        fill="toself",
        fillcolor="rgba(129,199,132,0.18)",
        line=dict(width=0),
        showlegend=False,
        hoverinfo="skip",
    ))

    # Loss fill
    fig.add_trace(go.Scatter(
        x=np.concatenate([spots, spots[::-1]]),
        y=np.concatenate([
            np.where(pnl_expiry < 0, pnl_expiry, 0),
            np.zeros(n_points),
        ]),
        fill="toself",
        fillcolor="rgba(229,115,115,0.18)",
        line=dict(width=0),
        showlegend=False,
        hoverinfo="skip",
    ))

    # Pre-expiry BS curve
    if pnl_now is not None:
        fig.add_trace(go.Scatter(
            x=list(spots),
            y=list(pnl_now),
            name=f"P&L now (T={T_years:.3f}yr)",
            line=dict(color=now_color, width=2, dash="dot"),
            hovertemplate="Spot $%{x:.2f}<br>P&L $%{y:.4f}<extra>Now</extra>",
        ))

    # Expiry P&L solid line
    fig.add_trace(go.Scatter(
        x=list(spots),
        y=list(pnl_expiry),
        name="P&L at expiry",
        line=dict(color="#4FC3F7", width=2.5),
        hovertemplate="Spot $%{x:.2f}<br>P&L $%{y:.4f}<extra>Expiry</extra>",
    ))

    # Breakeven marker
    fig.add_vline(
        x=be, line_dash="dash", line_color="rgba(255,255,255,0.45)",
        annotation_text=be_label,
        annotation_position="top right",
        annotation_font_color="rgba(255,255,255,0.8)",
    )

    # Strike marker
    fig.add_vline(
        x=strike, line_dash="dot", line_color="rgba(255,183,77,0.6)",
        annotation_text=f"K={strike}",
        annotation_position="bottom right",
        annotation_font_color="#FFB74D",
    )

    # Current spot marker
    if spot:
        fig.add_vline(
            x=spot, line_dash="dash", line_color="rgba(255,255,255,0.30)",
            annotation_text=f"Spot={spot}",
            annotation_position="top left",
            annotation_font_color="rgba(255,255,255,0.6)",
        )

    # Max-loss / max-gain annotations
    y_lo = float(pnl_expiry.min())
    y_hi = float(pnl_expiry.max())
    max_gain_text = f"Max Gain: ${'∞' if (position == 'long' and option_type == 'call') else f'{y_hi:.2f}'}"
    max_loss_text = f"Max Loss: ${abs(y_lo):.2f}" if y_lo > -1e8 else "Max Loss: ∞"

    title_parts = [
        f"{'Long' if position == 'long' else 'Short'} {option_type.upper()}",
        f"K={strike}",
    ]
    if ticker:  title_parts.insert(0, ticker)
    if expiry:  title_parts.append(f"exp {expiry}")

    subtitle = f"Premium {'paid' if position == 'long' else 'received'}: ${premium_paid:.4f}"
    if greek_text:
        subtitle += f"   |   {greek_text}"

    fig.update_layout(
        title=dict(
            text=f"{'  |  '.join(title_parts)}<br><sup>{subtitle}</sup>",
            font=dict(size=16),
        ),
        xaxis=dict(title="Spot Price at Expiry ($)", tickprefix="$"),
        yaxis=dict(title="Profit / Loss ($)", tickprefix="$", zeroline=False),
        template="plotly_dark",
        height=480,
        legend=dict(x=0.02, y=0.97, bgcolor="rgba(0,0,0,0.3)"),
        hovermode="x unified",
        annotations=[
            dict(
                x=0.98, y=0.95, xref="paper", yref="paper",
                text=max_gain_text, showarrow=False,
                font=dict(color=profit_color, size=12),
                align="right",
            ),
            dict(
                x=0.98, y=0.05, xref="paper", yref="paper",
                text=max_loss_text, showarrow=False,
                font=dict(color=loss_color, size=12),
                align="right",
            ),
        ],
    )
    return fig


# ── Convenience wrappers ──────────────────────────────────────────────────────

def long_call(strike, premium, **kw) -> go.Figure:
    return payoff_diagram(strike, premium, "call", "long", **kw)

def long_put(strike, premium, **kw) -> go.Figure:
    return payoff_diagram(strike, premium, "put", "long", **kw)

def short_call(strike, premium, **kw) -> go.Figure:
    return payoff_diagram(strike, premium, "call", "short", **kw)

def short_put(strike, premium, **kw) -> go.Figure:
    return payoff_diagram(strike, premium, "put", "short", **kw)