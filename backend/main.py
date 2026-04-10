"""
main.py
=======
Streamlit front-end for the Agentic Options Trading Analyst.
Run with:  streamlit run main.py
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import json
import logging
import time
from datetime import datetime, timedelta

import streamlit as st

st.set_page_config(
    page_title="Options Analyst",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

from agents.orchestrator import Orchestrator
from config import RISK_FREE_RATE

from visualization.payoff_diagram   import payoff_diagram
from visualization.price_heatmap    import price_heatmap
from visualization.greeks_plot      import greeks_vs_spot
from visualization.bs_price_plot    import bs_price_vs_strikes
from visualization.volatility_smile import volatility_smile
from visualization.mispricing_bar   import mispricing_bar

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")

# ─────────────────────────────────────────────────────────────────────────────
# Styling
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
html, body, [class*="css"] { font-family: 'IBM Plex Mono', monospace; }
.stApp { background: #0B0F17; color: #E2E8F0; }

section[data-testid="stSidebar"] {
    background: #0F1620;
    border-right: 1px solid #1E2D40;
}

[data-testid="metric-container"] {
    background: #111827;
    border: 1px solid #1E2D40;
    border-radius: 8px;
    padding: 12px 16px;
}
[data-testid="metric-container"] label { color: #64748B !important; font-size: 0.72rem; }
[data-testid="metric-container"] [data-testid="stMetricValue"] {
    color: #F1F5F9 !important; font-size: 1.35rem; font-weight: 700;
}

.stTabs [data-baseweb="tab-list"] {
    background: #0F1620;
    border-bottom: 1px solid #1E2D40;
    gap: 4px;
}
.stTabs [data-baseweb="tab"] {
    color: #64748B;
    border-radius: 4px 4px 0 0;
    padding: 8px 18px;
    font-size: 0.82rem;
    letter-spacing: 0.04em;
}
.stTabs [aria-selected="true"] {
    background: #1E2D40 !important;
    color: #38BDF8 !important;
    border-bottom: 2px solid #38BDF8;
}

.signal-box {
    border-radius: 8px;
    padding: 14px 20px;
    margin: 10px 0;
    font-weight: 600;
    font-size: 1.05rem;
    letter-spacing: 0.03em;
}
.signal-buy  { background: rgba(34,197,94,0.12);  border-left: 4px solid #22C55E; color: #86EFAC; }
.signal-sell { background: rgba(239,68,68,0.12);  border-left: 4px solid #EF4444; color: #FCA5A5; }
.signal-hold { background: rgba(99,102,241,0.12); border-left: 4px solid #6366F1; color: #A5B4FC; }
.risk-low    { background: rgba(34,197,94,0.08);  border-left: 4px solid #22C55E; color: #86EFAC; }
.risk-mod    { background: rgba(234,179,8,0.10);  border-left: 4px solid #EAB308; color: #FDE047; }
.risk-high   { background: rgba(239,68,68,0.10);  border-left: 4px solid #EF4444; color: #FCA5A5; }
.risk-vhigh  { background: rgba(220,38,38,0.18);  border-left: 4px solid #DC2626; color: #FCA5A5; }

.strategy-card {
    background: #111827;
    border: 1px solid #1E2D40;
    border-radius: 10px;
    padding: 20px 24px;
    margin: 8px 0;
}
.strategy-card h3 { color: #38BDF8; margin: 0 0 6px 0; font-size: 1.1rem; }
.strategy-card .label { color: #64748B; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; }
.strategy-card .value { color: #E2E8F0; font-size: 0.95rem; margin-bottom: 12px; }

.explanation {
    background: #111827;
    border: 1px solid #1E2D40;
    border-radius: 10px;
    padding: 22px 26px;
    line-height: 1.75;
    font-size: 0.92rem;
    color: #CBD5E1;
}

.section-header {
    font-size: 0.70rem;
    letter-spacing: 0.12em;
    color: #38BDF8;
    text-transform: uppercase;
    border-bottom: 1px solid #1E2D40;
    padding-bottom: 4px;
    margin: 18px 0 10px 0;
}

.stProgress > div > div > div { background: #38BDF8 !important; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0B0F17; }
::-webkit-scrollbar-thumb { background: #1E2D40; border-radius: 3px; }
</style>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# Sidebar
# ─────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⬡ Options Analyst")
    st.markdown("<div class='section-header'>Contract Parameters</div>", unsafe_allow_html=True)

    ticker      = st.text_input("Ticker", value="AAPL").upper().strip()
    option_type = st.selectbox("Option Type", ["call", "put"])

    default_expiry = (datetime.today() + timedelta(days=30)).strftime("%Y-%m-%d")
    expiry = st.date_input(
        "Expiry Date",
        value=datetime.strptime(default_expiry, "%Y-%m-%d"),
        min_value=datetime.today(),
    ).strftime("%Y-%m-%d")

    strike = st.number_input("Strike Price ($)", min_value=1.0, value=180.0, step=1.0)

    st.markdown("<div class='section-header'>Model Settings</div>", unsafe_allow_html=True)
    risk_free = st.slider("Risk-Free Rate", 0.0, 0.15, RISK_FREE_RATE, 0.001, format="%.3f")
    position  = st.selectbox("Position (for Payoff Diagram)", ["long", "short"])

    st.markdown("<div class='section-header'>Visualisation</div>", unsafe_allow_html=True)
    show_delta_heatmap = st.checkbox("Show Delta in Heatmap", value=True)

    st.markdown("---")
    run_btn = st.button("▶  Run Analysis", use_container_width=True, type="primary")
    st.caption(f"r = {risk_free:.3f}  |  pos = {position}")


# ─────────────────────────────────────────────────────────────────────────────
# Header
# ─────────────────────────────────────────────────────────────────────────────
col_title, col_time = st.columns([3, 1])
with col_title:
    st.markdown(f"# 📊 {ticker} · {option_type.upper()} · K={strike} · {expiry}")
with col_time:
    st.markdown(
        f"<div style='text-align:right;color:#64748B;font-size:0.78rem;margin-top:18px'>"
        f"{datetime.now().strftime('%Y-%m-%d  %H:%M:%S')}</div>",
        unsafe_allow_html=True,
    )

st.markdown("---")


# ─────────────────────────────────────────────────────────────────────────────
# Session state
# ─────────────────────────────────────────────────────────────────────────────
if "result" not in st.session_state:
    st.session_state.result = None
if "last_input" not in st.session_state:
    st.session_state.last_input = {}


# ─────────────────────────────────────────────────────────────────────────────
# Run pipeline
# ─────────────────────────────────────────────────────────────────────────────
def _run_analysis():
    current_input = dict(
        ticker=ticker, option_type=option_type,
        expiry=expiry, strike=strike, risk_free=risk_free,
    )
    if (
        st.session_state.result is not None
        and st.session_state.last_input == current_input
    ):
        return

    progress_bar   = st.progress(0)
    status_text    = st.empty()
    step_container = st.empty()
    start = time.time()

    def on_progress(label: str, pct: int):
        progress_bar.progress(pct / 100)
        status_text.markdown(
            f"<div style='color:#38BDF8;font-size:0.8rem'>⟳  {label}</div>",
            unsafe_allow_html=True,
        )
        step_container.markdown(
            f"<div style='color:#334155;font-size:0.75rem'>{label} … {pct}%</div>",
            unsafe_allow_html=True,
        )

    try:
        orch   = Orchestrator()
        result = orch.run(
            ticker=ticker,
            option_type=option_type,
            expiry=expiry,
            strike=strike,
            risk_free_rate=risk_free,
            progress_callback=on_progress,
        )
        elapsed = time.time() - start
        st.session_state.result     = result
        st.session_state.last_input = current_input
        progress_bar.progress(1.0)
        status_text.success(f"Analysis complete in {elapsed:.1f}s")
        step_container.empty()

    except Exception as exc:
        progress_bar.empty()
        status_text.error(f"Pipeline error: {exc}")
        st.exception(exc)


if run_btn:
    _run_analysis()


# ─────────────────────────────────────────────────────────────────────────────
# Guard
# ─────────────────────────────────────────────────────────────────────────────
result = st.session_state.result
if result is None:
    st.info("Configure the contract in the sidebar and click **▶ Run Analysis** to start.")
    st.stop()


# ─────────────────────────────────────────────────────────────────────────────
# Unpack results
# ─────────────────────────────────────────────────────────────────────────────
inp        = result.get("input", {})
spot_data  = result.get("spot_price_data", {})
hv_data    = result.get("historical_vol_data", {})
bs_data    = result.get("bs_price_data", {})
greeks     = result.get("greeks", {})
iv_data    = result.get("iv_data", {})
misp       = result.get("mispricing", {})
strat      = result.get("strategy", {})
skew       = result.get("volatility_skew", {})
model_risk = result.get("model_risk", {})
expl       = result.get("explanation", {})
chain      = result.get("options_chain", {})

spot         = spot_data.get("spot_price",   0)
sigma        = hv_data.get("historical_vol", 0.20)
bs_price_val = bs_data.get("bs_price",       0)
market_price = misp.get("market_price",      bs_price_val)
T_years      = bs_data.get("T_years",        0.083)
iv_val       = iv_data.get("implied_volatility")
delta        = greeks.get("delta", 0)
action       = strat.get("action", "HOLD")
risk_level   = model_risk.get("risk_level", "N/A")
misp_pct     = misp.get("mispricing_pct") or 0.0
direction    = misp.get("direction", "fairly_priced")


# ─────────────────────────────────────────────────────────────────────────────
# Row 1 – Key Metrics
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("<div class='section-header'>Market Snapshot</div>", unsafe_allow_html=True)

c1, c2, c3, c4, c5, c6, c7 = st.columns(7)
c1.metric("Spot Price",   f"${spot:.2f}",          f"{spot_data.get('change_pct', 0):+.2f}%")
c2.metric("BS Price",     f"${bs_price_val:.4f}")
c3.metric("Market Price", f"${market_price:.4f}")
c4.metric("Hist. Vol",    f"{sigma:.1%}")
c5.metric("Implied Vol",  f"{iv_val:.1%}" if iv_val else "N/A")
c6.metric("Delta",        f"{delta:+.3f}")
c7.metric("Mispricing",   f"{misp_pct:+.2f}%",
          delta_color="inverse" if misp_pct < 0 else "normal")

st.markdown("")

# Signal + risk badges
sig_col, risk_col = st.columns(2)
with sig_col:
    css_cls = {"BUY": "signal-buy", "SELL": "signal-sell"}.get(action, "signal-hold")
    st.markdown(
        f"<div class='signal-box {css_cls}'>"
        f"{'🟢' if action == 'BUY' else '🔴' if action == 'SELL' else '⚪'} "
        f"Signal: <strong>{action}</strong> — {strat.get('strategy', '')}"
        f"</div>",
        unsafe_allow_html=True,
    )
with risk_col:
    risk_css = {
        "LOW": "risk-low", "MODERATE": "risk-mod",
        "HIGH": "risk-high", "VERY HIGH": "risk-vhigh",
    }.get(risk_level, "risk-mod")
    st.markdown(
        f"<div class='signal-box {risk_css}'>"
        f"⚠️  Model Risk: <strong>{risk_level}</strong> "
        f"({model_risk.get('risk_score', 0)}/100)"
        f"</div>",
        unsafe_allow_html=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tabs
# ─────────────────────────────────────────────────────────────────────────────
tabs = st.tabs([
    "📋 Overview",
    "🎯 Strategy",
    "📈 Greeks",
    "💰 Payoff Diagram",
    "🌡️ Price Heatmap",
    "😄 Vol Smile",
    "📊 BS vs Strikes",
    "🔍 Raw Data",
])


# ── Tab 0 – Overview ──────────────────────────────────────────────────────────
with tabs[0]:
    left, right = st.columns([1, 1])

    with left:
        st.markdown("<div class='section-header'>Mispricing</div>", unsafe_allow_html=True)
        fig_misp = mispricing_bar(bs_price_val, market_price, ticker, strike, option_type)
        st.plotly_chart(fig_misp, use_container_width=True)

    with right:
        st.markdown("<div class='section-header'>AI Explanation</div>", unsafe_allow_html=True)
        explanation_text = expl.get("explanation", "_No explanation generated._")
        src   = expl.get("source", "")
        model_name = expl.get("model", "")
        st.markdown(
            f"<div class='explanation'>{explanation_text}</div>",
            unsafe_allow_html=True,
        )
        st.caption(f"Source: {src}  |  Model: {model_name}  |  Tokens: {expl.get('tokens_used', 'N/A')}")

    st.markdown("<div class='section-header'>Model Risk Flags</div>", unsafe_allow_html=True)
    for flag in model_risk.get("flags", []):
        st.warning(flag, icon="⚠️")


# ── Tab 1 – Strategy (NEW FULL TAB) ──────────────────────────────────────────
with tabs[1]:

    # ── Top action banner ─────────────────────────────────────────────────────
    css_cls = {"BUY": "signal-buy", "SELL": "signal-sell"}.get(action, "signal-hold")
    action_icon = "🟢" if action == "BUY" else "🔴" if action == "SELL" else "⚪"
    st.markdown(
        f"<div class='signal-box {css_cls}' style='font-size:1.3rem;padding:18px 24px'>"
        f"{action_icon} &nbsp; <strong>{action}</strong> &nbsp;·&nbsp; {strat.get('strategy', 'N/A')}"
        f"</div>",
        unsafe_allow_html=True,
    )

    st.markdown("")

    # ── Strategy detail cards ─────────────────────────────────────────────────
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("<div class='section-header'>Trade Details</div>", unsafe_allow_html=True)
        st.markdown(
            f"""
            <div class='strategy-card'>
                <div class='label'>Strategy Name</div>
                <div class='value'>{strat.get('strategy', 'N/A')}</div>
                <div class='label'>Action</div>
                <div class='value'>{strat.get('action', 'N/A')}</div>
                <div class='label'>Risk Level</div>
                <div class='value'>{strat.get('risk_level', 'N/A')}</div>
                <div class='label'>Max Loss</div>
                <div class='value'>{strat.get('max_loss', 'N/A')}</div>
                <div class='label'>Max Gain</div>
                <div class='value'>{strat.get('max_profit', 'N/A')}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<div class='section-header'>Mispricing Context</div>", unsafe_allow_html=True)
        st.markdown(
            f"""
            <div class='strategy-card'>
                <div class='label'>Direction</div>
                <div class='value'>{direction.replace('_', ' ').title()}</div>
                <div class='label'>BS Price</div>
                <div class='value'>${bs_price_val:.4f}</div>
                <div class='label'>Market Price</div>
                <div class='value'>${market_price:.4f}</div>
                <div class='label'>Deviation</div>
                <div class='value'>{misp_pct:+.2f}%</div>
                <div class='label'>Signal</div>
                <div class='value'>{misp.get('signal', 'N/A').replace('_', ' ').title()}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col2:
        st.markdown("<div class='section-header'>Rationale</div>", unsafe_allow_html=True)
        st.markdown(
            f"""
            <div class='strategy-card'>
                <div class='label'>Core Rationale</div>
                <div class='value' style='line-height:1.7'>{strat.get('rationale', 'N/A')}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<div class='section-header'>Volatility Commentary</div>", unsafe_allow_html=True)
        vol_comment = strat.get("vol_commentary") or "No volatility commentary available."
        st.markdown(
            f"""
            <div class='strategy-card'>
                <div class='label'>IV vs HV Analysis</div>
                <div class='value' style='line-height:1.7'>{vol_comment}</div>
                <div class='label'>Implied Volatility</div>
                <div class='value'>{f"{strat.get('implied_vol'):.1%}" if strat.get('implied_vol') else 'N/A'}</div>
                <div class='label'>Historical Volatility</div>
                <div class='value'>{f"{strat.get('historical_vol'):.1%}" if strat.get('historical_vol') else 'N/A'}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("<div class='section-header'>Delta Commentary</div>", unsafe_allow_html=True)
        delta_comment = strat.get("delta_commentary") or "No delta commentary available."
        st.markdown(
            f"""
            <div class='strategy-card'>
                <div class='label'>Delta Interpretation</div>
                <div class='value' style='line-height:1.7'>{delta_comment}</div>
                <div class='label'>Delta Value</div>
                <div class='value'>{delta:+.4f}</div>
                <div class='label'>Approx. ITM Probability</div>
                <div class='value'>{abs(delta)*100:.1f}%</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
            # ── Break-even analysis ───────────────────────────────────────────────────
    st.markdown("<div class='section-header'>Break-Even Analysis</div>", unsafe_allow_html=True)
    premium = market_price if market_price > 0.001 else bs_price_val
    be      = strike + premium if option_type == "call" else strike - premium
    be_dist = abs(spot - be)
    be_pct  = be_dist / spot * 100

    b1, b2, b3, b4 = st.columns(4)
    b1.metric("Premium Paid",    f"${premium:.4f}")
    b2.metric("Break-Even",      f"${be:.2f}")
    b3.metric("Distance to BE",  f"${be_dist:.2f}")
    b4.metric("BE Move Required", f"{be_pct:.2f}%")

    # ── Role-Based Actions (FIXED) ───────────────────────────────────────────
    st.markdown("<div class='section-header'>Role-Based Actions</div>", unsafe_allow_html=True)

    role_actions = strat.get("actions_by_role", {})

    r1, r2, r3 = st.columns(3)

    def render_role(col, role, value):
        color = {
            "BUY": "#22C55E",
            "SELL": "#EF4444",
            "HOLD": "#6366F1"
        }.get(value, "#64748B")

        col.markdown(
            f"""
            <div class='strategy-card'>
                <div class='label'>{role}</div>
                <div class='value' style='color:{color};font-weight:700'>{value}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    render_role(r1, "Trader", role_actions.get("trader", "N/A"))
    render_role(r2, "Hedger", role_actions.get("hedger", "N/A"))
    render_role(r3, "Arbitrageur", role_actions.get("arbitrageur", "N/A"))

    # ── Role Insights (FIXED CLEAN TEXT) ─────────────────────────────────────
    st.markdown("<div class='section-header'>Role Insights</div>", unsafe_allow_html=True)

    role_insights = strat.get("role_insights", {})

    st.markdown("### 🧑‍💼 Trader Perspective")
    st.write(role_insights.get("trader", "N/A"))

    st.markdown("### 🛡️ Hedger Perspective")
    st.write(role_insights.get("hedger", "N/A"))

    st.markdown("### 💰 Arbitrageur Perspective")
    st.write(role_insights.get("arbitrageur", "N/A"))

    # ── Greeks summary in strategy context ────────────────────────────────────
    st.markdown("<div class='section-header'>Greeks at a Glance</div>", unsafe_allow_html=True)
    g1, g2, g3, g4, g5 = st.columns(5)
    g1.metric("Delta Δ",  f"{greeks.get('delta', 0):+.4f}",  help="Directional exposure")
    g2.metric("Gamma Γ",  f"{greeks.get('gamma', 0):.6f}",   help="Rate of delta change")
    g3.metric("Vega ν",   f"{greeks.get('vega', 0):.4f}",    help="Sensitivity to vol (per 1%)")
    g4.metric("Theta Θ",  f"{greeks.get('theta', 0):+.4f}",  help="Time decay per day")
    g5.metric("Rho ρ",    f"{greeks.get('rho', 0):+.4f}",    help="Sensitivity to rate (per 1%)")

    # ── Break-even analysis ───────────────────────────────────────────────────
    st.markdown("<div class='section-header'>Break-Even Analysis</div>", unsafe_allow_html=True)
    premium = market_price if market_price > 0.001 else bs_price_val
    be      = strike + premium if option_type == "call" else strike - premium
    be_dist = abs(spot - be)
    be_pct  = be_dist / spot * 100

    b1, b2, b3, b4 = st.columns(4)
    b1.metric("Premium Paid",    f"${premium:.4f}")
    b2.metric("Break-Even",      f"${be:.2f}")
    b3.metric("Distance to BE",  f"${be_dist:.2f}")
    b4.metric("BE Move Required", f"{be_pct:.2f}%")
    # ── Role-Based Actions (NEW) ─────────────────────────────────────────────
st.markdown("<div class='section-header'>Role-Based Actions</div>", unsafe_allow_html=True)

role_actions = strat.get("actions_by_role", {})

r1, r2, r3 = st.columns(3)

def render_role(col, role, value):
    color = {
        "BUY": "#22C55E",
        "SELL": "#EF4444",
        "HOLD": "#6366F1"
    }.get(value, "#64748B")

    col.markdown(
        f"""
        <div class='strategy-card'>
            <div class='label'>{role}</div>
            <div class='value' style='color:{color};font-weight:700'>{value}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

render_role(r1, "Trader", role_actions.get("trader", "N/A"))
render_role(r2, "Hedger", role_actions.get("hedger", "N/A"))
render_role(r3, "Arbitrageur", role_actions.get("arbitrageur", "N/A"))


# ── Role Insights ────────────────────────────────────────────────────────
st.markdown("<div class='section-header'>Role Insights</div>", unsafe_allow_html=True)

role_insights = strat.get("role_insights", {})

st.markdown(
    f"""
    <div class='strategy-card'>
        <div class='label'>Trader Perspective</div>
        <div class='value'>{role_insights.get('trader', 'N/A')}</div>

        <div class='label'>Hedger Perspective</div>
        <div class='value'>{role_insights.get('hedger', 'N/A')}</div>

        <div class='label'>Arbitrageur Perspective</div>
        <div class='value'>{role_insights.get('arbitrageur', 'N/A')}</div>
    </div>
    """,
    unsafe_allow_html=True,
)


# ── Tab 2 – Greeks ────────────────────────────────────────────────────────────
with tabs[2]:
    st.markdown("<div class='section-header'>Greeks Table</div>", unsafe_allow_html=True)
    gc1, gc2, gc3, gc4, gc5 = st.columns(5)
    gc1.metric("Delta Δ", f"{greeks.get('delta', 0):+.4f}")
    gc2.metric("Gamma Γ", f"{greeks.get('gamma', 0):.6f}")
    gc3.metric("Vega ν",  f"{greeks.get('vega', 0):.4f}",  help="Per 1% vol move")
    gc4.metric("Theta Θ", f"{greeks.get('theta', 0):+.4f}", help="Per calendar day")
    gc5.metric("Rho ρ",   f"{greeks.get('rho', 0):+.4f}",  help="Per 1% rate move")

    st.markdown("<div class='section-header'>Greeks vs Spot Price</div>", unsafe_allow_html=True)
    fig_greeks = greeks_vs_spot(
        strike=strike,
        T_years=T_years,
        r=risk_free,
        sigma=sigma,
        option_type=option_type,
        current_spot=spot,
    )
    st.plotly_chart(fig_greeks, use_container_width=True)


# ── Tab 3 – Payoff Diagram ────────────────────────────────────────────────────
with tabs[3]:
    st.markdown("<div class='section-header'>Payoff at Expiry</div>", unsafe_allow_html=True)
    premium = market_price if market_price > 0.001 else bs_price_val
    fig_payoff = payoff_diagram(
        strike=strike,
        premium_paid=premium,
        option_type=option_type,
        position=position,
        spot=spot,
        T_years=T_years,
        r=risk_free,
        sigma=sigma,
        ticker=ticker,
        expiry=expiry,
    )
    st.plotly_chart(fig_payoff, use_container_width=True)

    be = strike + premium if option_type == "call" else strike - premium
    p1, p2, p3 = st.columns(3)
    p1.metric("Premium",    f"${premium:.4f}")
    p2.metric("Break-Even", f"${be:.2f}")
    p3.metric("Max Loss",   f"${premium:.4f}" if position == "long" else "Unlimited")


# ── Tab 4 – Price Heatmap ─────────────────────────────────────────────────────
with tabs[4]:
    st.markdown("<div class='section-header'>BS Price & Delta across Spot × Volatility</div>",
                unsafe_allow_html=True)
    fig_heat = price_heatmap(
        strike=strike,
        T_years=T_years,
        r=risk_free,
        option_type=option_type,
        current_spot=spot,
        current_sigma=iv_val or sigma,
        show_delta=show_delta_heatmap,
    )
    st.plotly_chart(fig_heat, use_container_width=True)
    st.caption(
        "Cross-hair marks current (spot, implied vol). "
        "Left panel: theoretical price. Right panel: delta."
    )


# ── Tab 5 – Volatility Smile ──────────────────────────────────────────────────
with tabs[5]:
    st.markdown("<div class='section-header'>Implied Volatility vs Strike (Smile)</div>",
                unsafe_allow_html=True)
    skew_data = skew.get("skew_data", [])
    fig_smile = volatility_smile(
        skew_data=skew_data,
        target_strike=strike,
        spot=spot,
        option_type=option_type,
    )
    st.plotly_chart(fig_smile, use_container_width=True)

    skew_col1, skew_col2, skew_col3 = st.columns(3)
    skew_col1.metric("Skew Detected", "Yes ⚠️" if skew.get("skew_detected") else "No ✓")
    skew_col2.metric("IV Range",      f"{skew.get('skew_magnitude', 0):.1%}" if skew.get("skew_magnitude") else "—")
    skew_col3.metric("Strike IV",     f"{iv_val:.1%}" if iv_val else "N/A")


# ── Tab 6 – BS Price vs Strikes ───────────────────────────────────────────────
with tabs[6]:
    st.markdown("<div class='section-header'>Theoretical Price Across Strikes</div>",
                unsafe_allow_html=True)
    fig_bsp = bs_price_vs_strikes(
        spot=spot,
        T_years=T_years,
        r=risk_free,
        sigma=sigma,
        option_type=option_type,
        target_strike=strike,
    )
    st.plotly_chart(fig_bsp, use_container_width=True)


# ── Tab 7 – Raw Data ──────────────────────────────────────────────────────────
with tabs[7]:
    st.markdown("<div class='section-header'>Full Pipeline State</div>", unsafe_allow_html=True)

    sections = {
        "Input":              result.get("input"),
        "Spot Price Data":    spot_data,
        "Historical Vol":     hv_data,
        "BS Price":           bs_data,
        "Greeks":             greeks,
        "Implied Volatility": iv_data,
        "Mispricing":         misp,
        "Strategy":           strat,
        "Volatility Skew":    {k: v for k, v in skew.items() if k != "skew_data"},
        "Model Risk":         model_risk,
    }
    for label, data in sections.items():
        with st.expander(label, expanded=False):
            st.json(data)

    with st.expander("Options Chain (ATM ± 10 strikes)", expanded=False):
        side_key = "calls" if option_type == "call" else "puts"
        rows = chain.get(side_key, [])
        if rows:
            near = sorted(rows, key=lambda r: abs(r.get("strike", 0) - strike))[:10]
            st.json(near)
        else:
            st.write("No chain data.")

    safe_result = {k: v for k, v in result.items() if k != "options_chain"}
    st.download_button(
        "⬇ Download Analysis JSON",
        data=json.dumps(safe_result, indent=2, default=str),
        file_name=f"{ticker}_{option_type}_{strike}_{expiry}.json",
        mime="application/json",
    )