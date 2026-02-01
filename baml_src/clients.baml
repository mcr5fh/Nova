// Learn more about clients at https://docs.boundaryml.com/docs/snippets/clients/overview

// OpenAI client for agent loop
client<llm> GPT4o {
  provider openai
  options {
    model "gpt-5-mini"
    api_key env.OPENAI_API_KEY
  }
}

// Anthropic Haiku client for cost-efficient operations
client<llm> Haiku {
  provider anthropic
  options {
    model "claude-3-5-haiku-20241022"
    api_key env.ANTHROPIC_API_KEY
  }
}
