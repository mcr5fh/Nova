// Mermaid diagram generation for architectural visualization

// Container for different types of Mermaid diagrams
class DiagramSet {
  flow string  // Flowchart diagram showing process flow
  erd string   // Entity Relationship Diagram showing data models
  system_arch string  // System architecture diagram showing components
}

// Generate Mermaid diagrams based on conversation context
function GenerateMermaidDiagrams(
  messages: Message[],
  context: string
) -> DiagramSet {
  client Haiku

  prompt #"
    You are a technical architect specialized in creating clear, accurate Mermaid diagrams.

    Based on the conversation history and provided context, generate three types of Mermaid diagrams:

    1. **flow**: A flowchart showing the main process flow or decision tree
       - Use flowchart syntax (flowchart TD, flowchart LR, etc.)
       - Show key steps, decisions, and flow paths

    2. **erd**: An Entity Relationship Diagram showing data models
       - Use erDiagram syntax
       - Show entities, their attributes, and relationships
       - Include cardinality (one-to-many, many-to-many, etc.)

    3. **system_arch**: A system architecture diagram showing components
       - Use graph or flowchart syntax for component diagrams
       - Show major system components, services, and their interactions
       - Include external dependencies and data flows

    Context: {{ context }}

    Conversation History:
    {% for message in messages %}
    {{ message.role }}: {{ message.content }}
    {% endfor %}

    IMPORTANT RULES:
    - Each diagram must be valid Mermaid syntax
    - Keep diagrams concise but informative
    - Use clear, descriptive labels
    - Avoid overly complex diagrams (max 10-15 nodes per diagram)
    - If a diagram type isn't applicable, create a simple placeholder explaining why
    - DO NOT include markdown code fences (```mermaid) - just the raw Mermaid syntax

    {{ ctx.output_format }}
  "#
}
