"""Greeks vs spot price – line chart for all 5 Greeks."""
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from utils.bs_math import bs_greeks


def greeks_vs_spot(
    strike: float,
    T_years: float,
    r: float,
    sigma: float,
    option_type: str = "call",
    spot_range_pct: float = 0.30,
    current_spot: float | None = None,
) -> go.Figure:
    """
    Plot Delta, Gamma, Vega, Theta, Rho vs a range of spot prices.
    """
    centre = current_spot or strike
    spots  = np.linspace(centre * (1 - spot_range_pct), centre * (1 + spot_range_pct), 200)

    greek_series = {g: [] for g in ("delta", "gamma", "vega", "theta", "rho")}
    for S in spots:
        g = bs_greeks(S, strike, T_years, r, sigma, option_type)
        for key in greek_series:
            greek_series[key].append(g[key])

    fig = make_subplots(
        rows=3, cols=2,
        subplot_titles=["Delta", "Gamma", "Vega", "Theta", "Rho"],
        vertical_spacing=0.12,
    )
    layout = [
        ("delta", 1, 1, "#4FC3F7"),
        ("gamma", 1, 2, "#81C784"),
        ("vega",  2, 1, "#FFB74D"),
        ("theta", 2, 2, "#E57373"),
        ("rho",   3, 1, "#CE93D8"),
    ]
    for key, row, col, color in layout:
        fig.add_trace(
            go.Scatter(x=list(spots), y=greek_series[key], name=key.capitalize(),
                       line=dict(color=color, width=2)),
            row=row, col=col,
        )
        if current_spot:
            fig.add_vline(x=current_spot, line_dash="dash", line_color="white",
                          opacity=0.5, row=row, col=col)

    fig.update_layout(
        title=f"Greeks vs Spot Price  |  {option_type.upper()} K={strike}  T={T_years:.3f}yr  σ={sigma:.1%}",
        template="plotly_dark",
        height=700,
        showlegend=False,
    )
    return fig