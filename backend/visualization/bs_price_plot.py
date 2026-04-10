"""BS price across a range of strikes."""
import numpy as np
import plotly.graph_objects as go

from utils.bs_math import bs_price


def bs_price_vs_strikes(
    spot: float,
    T_years: float,
    r: float,
    sigma: float,
    option_type: str = "call",
    target_strike: float | None = None,
    n_strikes: int = 50,
) -> go.Figure:
    strikes = np.linspace(spot * 0.60, spot * 1.40, n_strikes)
    prices  = [bs_price(spot, K, T_years, r, sigma, option_type) for K in strikes]
    intrinsic = [
        max(spot - K, 0) if option_type == "call" else max(K - spot, 0)
        for K in strikes
    ]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=list(strikes), y=prices,
        name="BS Price", line=dict(color="#4FC3F7", width=2.5),
    ))
    fig.add_trace(go.Scatter(
        x=list(strikes), y=intrinsic,
        name="Intrinsic Value", line=dict(color="#81C784", width=1.5, dash="dot"),
    ))

    if target_strike:
        fig.add_vline(x=target_strike, line_dash="dash", line_color="#FFB74D",
                      annotation_text=f"K={target_strike}", annotation_position="top")

    fig.add_vline(x=spot, line_dash="dash", line_color="white", opacity=0.4,
                  annotation_text=f"Spot={spot}", annotation_position="bottom right")

    fig.update_layout(
        title=f"Black-Scholes Price vs Strike  |  {option_type.upper()}  S={spot}  T={T_years:.3f}yr  σ={sigma:.1%}",
        xaxis_title="Strike Price",
        yaxis_title="Option Price ($)",
        template="plotly_dark",
        height=420,
        legend=dict(x=0.02, y=0.97),
    )
    return fig