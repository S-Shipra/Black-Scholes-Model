"""Volatility smile – IV vs strike extracted from the live options chain."""
import plotly.graph_objects as go


def volatility_smile(
    skew_data: list[dict],
    target_strike: float | None = None,
    spot: float | None = None,
    option_type: str = "call",
) -> go.Figure:
    """
    Parameters
    ----------
    skew_data : list of {"strike": float, "iv": float}
    """
    if not skew_data:
        fig = go.Figure()
        fig.update_layout(title="No volatility smile data available", template="plotly_dark")
        return fig

    strikes = [d["strike"] for d in skew_data]
    ivs     = [d["iv"] * 100 for d in skew_data]   # display as %

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=strikes, y=ivs,
        mode="lines+markers",
        name="Implied Vol",
        line=dict(color="#FFB74D", width=2.5),
        marker=dict(size=6),
    ))

    if spot:
        fig.add_vline(x=spot, line_dash="dash", line_color="white", opacity=0.5,
                      annotation_text="Spot", annotation_position="top left")
    if target_strike:
        fig.add_vline(x=target_strike, line_dash="dash", line_color="#E57373",
                      annotation_text=f"K={target_strike}", annotation_position="top right")

    fig.update_layout(
        title=f"Volatility Smile – {option_type.upper()} Implied Volatility vs Strike",
        xaxis_title="Strike Price",
        yaxis_title="Implied Volatility (%)",
        template="plotly_dark",
        height=420,
    )
    return fig