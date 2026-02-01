// LLM Client Configurations for Nova Orchestrator

// Primary client for complex planning and reasoning
client<llm> GPT4 {
  provider openai
  options {
    model "gpt-4o"
    api_key env.OPENAI_API_KEY
    temperature 0.7
    max_tokens 4096
  }
}

// Fast, cost-effective client for simple worker tasks
client<llm> GPT4Mini {
  provider openai
  options {
    model "gpt-4o-mini"
    api_key env.OPENAI_API_KEY
    temperature 0.3
    max_tokens 2048
  }
}

// Alternative provider for fallback
client<llm> Claude {
  provider anthropic
  options {
    model "claude-sonnet-4-20250514"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 4096
  }
}

// Resilient client with automatic fallback
client<llm> ResilientPlanner {
  provider fallback
  options {
    strategy [
      GPT4
      Claude
    ]
  }
}
