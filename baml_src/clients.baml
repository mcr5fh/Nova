// LLM Client Configurations for Nova Orchestrator

// Primary client for complex planning and reasoning
client<llm> GPT5 {
  provider openai
  options {
    model "gpt-5"
    api_key env.OPENAI_API_KEY
    reasoning_effort "low"
    max_completion_tokens 4096
  }
}

// Fast, cost-effective client for simple worker tasks
client<llm> GPT5Mini {
  provider openai
  options {
    model "gpt-5-mini"
    api_key env.OPENAI_API_KEY
    reasoning_effort "minimal"
    max_completion_tokens 2048
  }
}

// Alternative provider for fallback
client<llm> Sonnet {
  provider anthropic
  options {
    model "claude-sonnet-4-5-20250929"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 4096
  }
}

// Resilient client with automatic fallback
client<llm> ResilientPlanner {
  provider fallback
  options {
    strategy [
      Sonnet,
      GPT5
    ]
  }
}
