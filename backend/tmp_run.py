import sys, os
from agents.orchestrator import Orchestrator
orch = Orchestrator()
# Pass 0.045 for risk_free_rate as we modified orchestrator to require it
orch.run("AAPL", "call", "2026-06-19", 255.0, 0.045)
