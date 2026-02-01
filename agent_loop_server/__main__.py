"""Entry point for agent loop server."""

import os
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def main():
    """Run the server."""
    host = os.getenv("AGENT_LOOP_HOST", "0.0.0.0")
    port = int(os.getenv("AGENT_LOOP_PORT", 8000))

    uvicorn.run(
        "agent_loop_server.server:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )


if __name__ == "__main__":
    main()
