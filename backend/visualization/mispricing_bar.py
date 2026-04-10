"""BS price vs market price – side-by-side bar chart."""
import plotly.graph_objects as go


def mispricing_bar(bs_price: float, market_price: float, ticker: str, strike: float, option_type: str) -> go.Figure:
    pct     = (market_price - bs_price) / bs_price * 100 if bs_price else 0
    color   = "#E57373" if pct > 0 else "#81C784"
    label   = f"Market is {'OVER' if pct > 0 else 'UNDER'}priced by {abs(pct):.2f}%"

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=["BS Theoretical", "Market Price"],
        y=[bs_price, market_price],
        marker_color=["#4FC3F7", color],
        text=[f"${bs_price:.4f}", f"${market_price:.4f}"],
        textposition="outside",
        width=0.4,
    ))
    fig.add_annotation(
        x=0.5, y=max(bs_price, market_price) * 1.12,
        text=label, showarrow=False,
        font=dict(size=14, color=color),
        xref="paper",
    )
    fig.update_layout(
        title=f"Mispricing – {ticker} {option_type.upper()} K={strike}",
        yaxis_title="Option Price ($)",
        template="plotly_dark",
        height=380,
        showlegend=False,
    )
    return fig