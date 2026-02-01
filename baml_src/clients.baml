// Learn more about clients at https://docs.boundaryml.com/docs/snippets/clients/overview

// OpenAI client for agent loop
client<llm> GPT4o {
  provider openai
  options {
    model "gpt-4o"
    api_key env.OPENAI_API_KEY
  }
}
