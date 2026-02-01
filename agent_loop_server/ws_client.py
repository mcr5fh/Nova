#!/usr/bin/env python3
"""WebSocket REPL client for Agent Loop Server.

Usage:
    python -m agent_loop_server.ws_client
    # or
    python agent_loop_server/ws_client.py
"""

import asyncio
import json
import sys
from datetime import datetime
from typing import Optional

try:
    import websockets
except ImportError:
    print("Error: websockets library not found.")
    print("Install with: uv pip install websockets")
    sys.exit(1)


class Colors:
    """ANSI color codes for terminal output."""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    # Colors
    BLUE = "\033[94m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"


class WebSocketClient:
    """Interactive WebSocket REPL client."""

    def __init__(self, url: str = "ws://localhost:8000/ws"):
        self.url = url
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.running = False

    def print_banner(self):
        """Print welcome banner."""
        print(f"\n{Colors.BOLD}{Colors.CYAN}╔══════════════════════════════════════════╗{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}║   Agent Loop WebSocket REPL Client      ║{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}╚══════════════════════════════════════════╝{Colors.RESET}\n")
        print(f"{Colors.DIM}Connecting to: {self.url}{Colors.RESET}")
        print(f"{Colors.DIM}Commands: /quit, /exit, /help{Colors.RESET}\n")

    def print_message(self, msg_type: str, content: str, **kwargs):
        """Print formatted message based on type."""
        timestamp = datetime.now().strftime("%H:%M:%S")

        if msg_type == "user_message":
            print(f"{Colors.DIM}[{timestamp}]{Colors.RESET} {Colors.BLUE}{Colors.BOLD}You:{Colors.RESET} {content}")

        elif msg_type == "agent_message":
            print(f"{Colors.DIM}[{timestamp}]{Colors.RESET} {Colors.GREEN}{Colors.BOLD}Agent:{Colors.RESET} {content}")

        elif msg_type == "tool_call":
            tool_name = kwargs.get("tool_name", "Unknown")
            tool_args = kwargs.get("tool_args", "")
            print(f"{Colors.DIM}[{timestamp}]{Colors.RESET} {Colors.YELLOW}🔧 Tool Call:{Colors.RESET} {Colors.BOLD}{tool_name}{Colors.RESET}")
            if tool_args:
                print(f"{Colors.DIM}   Args: {tool_args}{Colors.RESET}")

        elif msg_type == "tool_result":
            result = kwargs.get("result", content)
            print(f"{Colors.DIM}[{timestamp}]{Colors.RESET} {Colors.CYAN}✓ Result:{Colors.RESET}")
            # Indent and truncate long results
            lines = result.split("\n")
            for line in lines[:10]:  # Limit to 10 lines
                print(f"{Colors.DIM}   {line}{Colors.RESET}")
            if len(lines) > 10:
                print(f"{Colors.DIM}   ... ({len(lines) - 10} more lines){Colors.RESET}")

        elif msg_type == "error":
            print(f"{Colors.DIM}[{timestamp}]{Colors.RESET} {Colors.RED}✗ Error:{Colors.RESET} {content}")

        elif msg_type == "system":
            print(f"{Colors.DIM}[{timestamp}] {content}{Colors.RESET}")

        else:
            # Unknown message type - show raw
            print(f"{Colors.DIM}[{timestamp}] [{msg_type}] {content}{Colors.RESET}")

    async def receive_messages(self):
        """Listen for messages from server."""
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    msg_type = data.get("type", "unknown")

                    if msg_type == "user_message":
                        # Skip echoed user messages (we already printed them)
                        pass

                    elif msg_type == "agent_message":
                        self.print_message("agent_message", data.get("message", ""))

                    elif msg_type == "tool_call":
                        self.print_message(
                            "tool_call",
                            "",
                            tool_name=data.get("tool_name", "Unknown"),
                            tool_args=data.get("tool_args", "")
                        )

                    elif msg_type == "tool_result":
                        self.print_message(
                            "tool_result",
                            data.get("result", data.get("tool_result", "")),
                            result=data.get("result", data.get("tool_result", ""))
                        )

                    else:
                        # Unknown type - show raw
                        self.print_message("system", f"Raw: {json.dumps(data, indent=2)}")

                except json.JSONDecodeError:
                    self.print_message("error", f"Invalid JSON: {message}")

        except websockets.exceptions.ConnectionClosed:
            self.print_message("system", "Connection closed by server")
            self.running = False

    async def send_message(self, message: str):
        """Send chat message to server."""
        if not self.ws:
            self.print_message("error", "Not connected to server")
            return

        try:
            await self.ws.send(json.dumps({
                "type": "chat",
                "message": message
            }))
            self.print_message("user_message", message)

        except Exception as e:
            self.print_message("error", f"Failed to send: {e}")

    async def read_input(self):
        """Read user input from stdin."""
        loop = asyncio.get_event_loop()

        while self.running:
            try:
                # Read input in executor to avoid blocking
                user_input = await loop.run_in_executor(
                    None,
                    lambda: input(f"{Colors.BOLD}> {Colors.RESET}")
                )

                if not user_input.strip():
                    continue

                # Handle commands
                if user_input.startswith("/"):
                    command = user_input.lower().strip()

                    if command in ["/quit", "/exit", "/q"]:
                        self.print_message("system", "Exiting...")
                        self.running = False
                        break

                    elif command == "/help":
                        self.print_help()

                    else:
                        self.print_message("error", f"Unknown command: {command}")

                    continue

                # Send message to server
                await self.send_message(user_input)

            except EOFError:
                # Ctrl+D
                self.print_message("system", "\nExiting...")
                self.running = False
                break

            except KeyboardInterrupt:
                # Ctrl+C
                self.print_message("system", "\nUse /quit to exit")
                continue

    def print_help(self):
        """Print help message."""
        print(f"\n{Colors.BOLD}Available Commands:{Colors.RESET}")
        print(f"  {Colors.CYAN}/quit, /exit{Colors.RESET} - Exit the client")
        print(f"  {Colors.CYAN}/help{Colors.RESET}        - Show this help message")
        print(f"\n{Colors.BOLD}Usage:{Colors.RESET}")
        print(f"  Type your message and press Enter to send to the agent.")
        print(f"  The agent will respond and show tool calls in real-time.\n")

    async def connect(self):
        """Connect to WebSocket server and start REPL."""
        self.print_banner()

        try:
            self.print_message("system", "Connecting...")
            async with websockets.connect(self.url) as websocket:
                self.ws = websocket
                self.running = True
                self.print_message("system", f"{Colors.GREEN}✓ Connected!{Colors.RESET}\n")

                # Run receiver and input reader concurrently
                await asyncio.gather(
                    self.receive_messages(),
                    self.read_input()
                )

        except ConnectionRefusedError:
            self.print_message("error", f"Connection refused. Is the server running at {self.url}?")
            self.print_message("system", "Start server with: uv run python -m agent_loop_server")

        except Exception as e:
            self.print_message("error", f"Connection error: {e}")

        finally:
            print(f"\n{Colors.DIM}Goodbye!{Colors.RESET}\n")


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="WebSocket REPL client for Agent Loop Server")
    parser.add_argument(
        "--url",
        default="ws://localhost:8000/ws",
        help="WebSocket URL (default: ws://localhost:8000/ws)"
    )
    args = parser.parse_args()

    client = WebSocketClient(url=args.url)
    await client.connect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(0)
