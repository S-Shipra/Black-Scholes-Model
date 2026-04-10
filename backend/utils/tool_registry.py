"""
ToolRegistry
============
Central dict mapping tool names → (handler_fn, schema_dict).

Agents call  registry.call(tool_name, **kwargs)
and never invoke each other directly.
"""
from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Lightweight tool registry with schema validation stubs."""

    def __init__(self):
        self._tools: dict[str, dict[str, Any]] = {}

    # ── registration ──────────────────────────────────────────────────────────

    def register(
        self,
        name: str,
        handler: Callable,
        schema: dict | None = None,
        description: str = "",
    ) -> None:
        """Register a tool by name."""
        if name in self._tools:
            logger.warning("ToolRegistry: overwriting existing tool '%s'", name)
        self._tools[name] = {
            "handler":     handler,
            "schema":      schema or {},
            "description": description,
        }
        logger.debug("ToolRegistry: registered tool '%s'", name)

    # ── invocation ────────────────────────────────────────────────────────────

    def call(self, name: str, **kwargs) -> Any:
        """Invoke a registered tool by name, passing kwargs through."""
        if name not in self._tools:
            raise KeyError(f"ToolRegistry: unknown tool '{name}'")
        handler = self._tools[name]["handler"]
        logger.debug("ToolRegistry: calling tool '%s' with %s", name, list(kwargs.keys()))
        return handler(**kwargs)

    # ── introspection ─────────────────────────────────────────────────────────

    def list_tools(self) -> list[str]:
        return list(self._tools.keys())

    def describe(self, name: str) -> str:
        if name not in self._tools:
            return f"<unknown tool '{name}'>"
        return self._tools[name].get("description", "No description.")

    def all_descriptions(self) -> dict[str, str]:
        return {n: t["description"] for n, t in self._tools.items()}