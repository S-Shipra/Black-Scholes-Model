"""
Price Heatmap
=============
Black-Scholes option price across a 2-D grid of:
    x-axis → Spot price
    y-axis → Volatility (σ)

A second heatmap shows Delta across the same grid.
Both heatmaps share a cross-hair annotation at (current_spot, current_sigma).
"""
from __future__ import annotations

import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from utils.bs_math import bs_price as _bs_price, bs_greeks as _bs_greeks


def price_heatmap(
    strike: float,
    T_years: float,
    r: float,
    option_type: str = "call",
    current_spot: float | None = None,
    current_sigma: float | None = None,
    spot_range_pct: float = 0.35,
    sigma_lo: float = 0.05,
    sigma_hi: float = 0.90,
    n_spot: int = 60,
    n_sigma: int = 50,
    show_delta: bool = True,
) -> go.Figure:
    """
    Parameters
    ----------
    strike        : option strike
    T_years       : time to expiry in years
    r             : risk-free rate
    option_type   : "call" or "put"
    current_spot  : mark current position with a cross-hair
    current_sigma : mark current position with a cross-hair
    spot_range_pct: ± % around current_spot (or strike) for x-axis
    sigma_lo/hi   : volatility axis bounds
    n_spot, n_sigma: grid resolution
    show_delta    : if True, render a second subplot for Delta
    """
    centre = current_spot if current_spot else strike
    spots  = np.linspace(centre * (1 - spot_range_pct), centre * (1 + spot_range_pct), n_spot)
    sigmas = np.linspace(sigma_lo, sigma_hi, n_sigma)

    # ── Build grids ───────────────────────────────────────────────────────────
    price_grid = np.zeros((n_sigma, n_spot))
    delta_grid = np.zeros((n_sigma, n_spot))

    for i, sig in enumerate(sigmas):
        for j, S in enumerate(spots):
            price_grid[i, j] = _bs_price(S, strike, T_years, r, sig, option_type)
            if show_delta:
                delta_grid[i, j] = _bs_greeks(S, strike, T_years, r, sig, option_type)["delta"]

    # ── Colour scales ─────────────────────────────────────────────────────────
    # Price: deep navy → teal → gold
    price_colorscale = [
        [0.00, "#0D1B2A"],
        [0.25, "#1B4F72"],
        [0.50, "#1ABC9C"],
        [0.75, "#F39C12"],
        [1.00, "#E74C3C"],
    ]
    # Delta: blue (0) → white (0.5) → red (1)
    delta_colorscale = [
        [0.00, "#1565C0"],
        [0.50, "#E8EAF6"],
        [1.00, "#B71C1C"],
    ]

    tick_spots  = [round(s, 2) for s in spots[::max(1, n_spot  // 8)]]
    tick_sigmas = [f"{s:.0%}"  for s in sigmas[::max(1, n_sigma // 8)]]

    n_cols = 2 if show_delta else 1
    subplot_titles = [
        f"BS {option_type.upper()} Price",
        f"Delta",
    ][:n_cols]

    fig = make_subplots(
        rows=1, cols=n_cols,
        subplot_titles=subplot_titles,
        horizontal_spacing=0.12,
    )

    # ── Price heatmap ─────────────────────────────────────────────────────────
    fig.add_trace(
        go.Heatmap(
            z=price_grid,
            x=list(spots),
            y=[f"{s:.0%}" for s in sigmas],
            colorscale=price_colorscale,
            colorbar=dict(
                title="Price ($)",
                x=0.46 if show_delta else 1.0,
                thickness=14,
                len=0.85,
            ),
            hovertemplate=(
                "Spot: $%{x:.2f}<br>"
                "Vol: %{y}<br>"
                "Price: $%{z:.4f}<extra></extra>"
            ),
            name="BS Price",
        ),
        row=1, col=1,
    )

    # ── Delta heatmap ─────────────────────────────────────────────────────────
    if show_delta:
        # Clip delta to [0,1] for calls, [-1,0] for puts for better colour range
        d_lo = 0.0 if option_type == "call" else -1.0
        d_hi = 1.0 if option_type == "call" else  0.0
        delta_grid_clipped = np.clip(delta_grid, d_lo, d_hi)

        fig.add_trace(
            go.Heatmap(
                z=delta_grid_clipped,
                x=list(spots),
                y=[f"{s:.0%}" for s in sigmas],
                colorscale=delta_colorscale,
                zmid=0.5 if option_type == "call" else -0.5,
                colorbar=dict(
                    title="Delta",
                    x=1.0,
                    thickness=14,
                    len=0.85,
                ),
                hovertemplate=(
                    "Spot: $%{x:.2f}<br>"
                    "Vol: %{y}<br>"
                    "Delta: %{z:.4f}<extra></extra>"
                ),
                name="Delta",
            ),
            row=1, col=2,
        )

    # ── Cross-hair at current (spot, sigma) ───────────────────────────────────
    if current_spot is not None:
        for col in range(1, n_cols + 1):
            fig.add_vline(
                x=current_spot,
                line_color="rgba(255,255,255,0.55)",
                line_dash="dash",
                line_width=1.5,
                row=1, col=col,
            )

    if current_sigma is not None:
        sigma_label = f"{current_sigma:.0%}"
        for col in range(1, n_cols + 1):
            fig.add_hline(
                y=sigma_label,
                line_color="rgba(255,255,255,0.55)",
                line_dash="dash",
                line_width=1.5,
                row=1, col=col,
            )

    # ── Strike line ───────────────────────────────────────────────────────────
    for col in range(1, n_cols + 1):
        fig.add_vline(
            x=strike,
            line_color="rgba(255,183,77,0.70)",
            line_dash="dot",
            line_width=1.5,
            annotation_text=f"K={strike}",
            annotation_position="top",
            annotation_font_color="#FFB74D",
            row=1, col=col,
        )

    # ── Layout ────────────────────────────────────────────────────────────────
    fig.update_layout(
        title=dict(
            text=(
                f"BS {option_type.upper()} Price & Delta Heatmap  |  "
                f"K={strike}  T={T_years:.3f}yr  r={r:.1%}"
            ),
            font=dict(size=15),
        ),
        template="plotly_dark",
        height=460,
        paper_bgcolor="#0E1117",
        plot_bgcolor="#0E1117",
    )

    # Axis labels
    fig.update_xaxes(title_text="Spot Price ($)", tickprefix="$", row=1, col=1)
    fig.update_yaxes(title_text="Volatility (σ)", row=1, col=1)
    if show_delta:
        fig.update_xaxes(title_text="Spot Price ($)", tickprefix="$", row=1, col=2)
        fig.update_yaxes(showticklabels=False, row=1, col=2)

    return fig


# ── Extra: single-panel convenience ──────────────────────────────────────────

def price_heatmap_single(
    strike: float,
    T_years: float,
    r: float,
    option_type: str = "call",
    current_spot: float | None = None,
    current_sigma: float | None = None,
    **kwargs,
) -> go.Figure:
    """Single-panel version – only the price heatmap."""
    return price_heatmap(
        strike=strike,
        T_years=T_years,
        r=r,
        option_type=option_type,
        current_spot=current_spot,
        current_sigma=current_sigma,
        show_delta=False,
        **kwargs,
    )