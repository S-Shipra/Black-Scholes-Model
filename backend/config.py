import os
from dotenv import load_dotenv

load_dotenv()

# ── Groq ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ── Risk-free rate ────────────────────────────────────────────────────────────
RISK_FREE_RATE = float(os.getenv("RISK_FREE_RATE", "0.045"))

# ── Historical-volatility window (trading days) ───────────────────────────────
HV_WINDOW = int(os.getenv("HV_WINDOW", "30"))

# ── Mispricing threshold ──────────────────────────────────────────────────────
MISPRICING_THRESHOLD_PCT = float(os.getenv("MISPRICING_THRESHOLD_PCT", "0.5"))

# ── Volatility-skew warning threshold ────────────────────────────────────────
SKEW_THRESHOLD = float(os.getenv("SKEW_THRESHOLD", "0.05"))

# ── IV vs HV divergence warning threshold ────────────────────────────────────
IV_HV_DIVERGENCE_THRESHOLD = float(os.getenv("IV_HV_DIVERGENCE_THRESHOLD", "0.10"))

# ── Outputs directory ─────────────────────────────────────────────────────────
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)