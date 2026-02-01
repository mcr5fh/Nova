# Mermaid Diagram Generation

The `GenerateMermaidDiagrams` BAML function generates three types of Mermaid diagrams based on conversation context:

1. **Flow Diagram** - Process flows, decision trees, workflows
2. **ERD Diagram** - Entity Relationship Diagrams for data models
3. **System Architecture** - Component diagrams, service interactions

## Setup

The function uses Claude Haiku for cost-efficient diagram generation. Make sure you have the `ANTHROPIC_API_KEY` environment variable set:

```bash
export ANTHROPIC_API_KEY='your-api-key'
```

## Usage

```python
from agent_loop_server.baml_client import b
from agent_loop_server.baml_client.types import Message, MessageRole

# Prepare conversation history
messages = [
    Message(
        role=MessageRole.User,
        content="We're building an e-commerce platform"
    ),
    Message(
        role=MessageRole.Assistant,
        content="I can help design the system architecture"
    )
]

# Provide context about what to diagram
context = """
E-commerce Platform:
- User authentication
- Product catalog
- Shopping cart
- Order processing
- Payment integration
"""

# Generate all three diagram types
diagrams = b.GenerateMermaidDiagrams(
    messages=messages,
    context=context
)

# Access individual diagrams
print("Flow:", diagrams.flow)
print("ERD:", diagrams.erd)
print("Architecture:", diagrams.system_arch)
```

## Examples

Run the example script to see the function in action:

```bash
python example_mermaid_diagrams.py
```

This generates diagrams for:
- E-commerce platform
- Microservices architecture

## Visualizing Diagrams

To view the generated Mermaid diagrams:

1. **Online**: Copy the diagram text to [mermaid.live](https://mermaid.live)
2. **VSCode**: Use the "Markdown Preview Mermaid Support" extension
3. **GitHub**: Paste in markdown files with ` ```mermaid ` code blocks
4. **Jupyter**: Use `%%mermaid` magic command

## BAML Files

- **Source**: `baml_src/diagrams.baml` - Function and class definitions
- **Client**: `baml_src/clients.baml` - Haiku client configuration
- **Generated**: `agent_loop_server/baml_client/` - Python client code

## Cost Efficiency

This function uses Claude 3.5 Haiku, which is:
- ~20x cheaper than Claude 3.5 Sonnet
- Fast response times (typically < 2 seconds)
- Suitable for structured diagram generation tasks

## Regenerating Client

After modifying BAML files, regenerate the Python client:

```bash
.venv/bin/baml-cli generate
```

This updates all generated files in `agent_loop_server/baml_client/`.
