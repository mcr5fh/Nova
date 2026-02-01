"""Agent Loop Server - BAML-based chat agent with tools."""

__version__ = "0.1.0"

# Conditional imports to allow tests to run before implementation
try:
    from .agent import AgentLoopRunner
except ImportError:
    AgentLoopRunner = None

try:
    from .tools import ToolExecutor
except ImportError:
    ToolExecutor = None

__all__ = ["AgentLoopRunner", "ToolExecutor"]
