import type { CodebaseContext, SolutionSpecV2, ImplementationDiagram } from './types.js';
import type { LLMAdapter } from '../../shared/llm/types.js';

/** Node definition for programmatic flowchart creation */
export interface FlowchartNode {
  id: string;
  label: string;
}

/** Edge definition for programmatic flowchart creation */
export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
}

/**
 * Generate an implementation diagram showing component interactions and data flows.
 * Uses LLM to create a high-level Mermaid flowchart based on codebase context.
 */
export async function generateImplementationDiagram(
  context: CodebaseContext,
  spec: SolutionSpecV2,
  llm: LLMAdapter
): Promise<ImplementationDiagram> {
  const prompt = buildDiagramPrompt(context, spec);

  try {
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      'You are a software architect who creates clear Mermaid diagrams. Return only the diagram syntax, no explanations.'
    );

    const mermaid = response.content.trim();

    return {
      type: 'flowchart',
      mermaid,
      description: `Implementation diagram showing ${spec.solutionSummary} component interactions`,
      generatedAt: Date.now(),
    };
  } catch {
    return generateFallbackDiagram(spec);
  }
}

/**
 * Build the prompt for LLM diagram generation
 */
function buildDiagramPrompt(context: CodebaseContext, spec: SolutionSpecV2): string {
  const filesList = context.files
    .filter(f => f.relevance === 'high' || f.relevance === 'medium')
    .map(f => `- ${f.path} (${f.type}): ${f.description}`)
    .join('\n');

  const patternsList = context.patterns
    .map(p => `- ${p.name}: ${p.description}`)
    .join('\n');

  const techStackStr = context.techStack.join(', ');

  return `Create a Mermaid flowchart diagram showing the implementation architecture for this solution.

## Solution Summary
${spec.solutionSummary}

## Scope
Included: ${spec.scope.included.join(', ')}

## Tech Stack
${techStackStr || 'Not specified'}

## Relevant Files
${filesList || 'No files identified'}

## Patterns Used
${patternsList || 'No patterns identified'}

## Architecture
${context.architecture || 'Not specified'}

## Instructions
Generate a Mermaid flowchart that:
1. Shows the main components involved in implementing this solution
2. Indicates data flow between components with arrows
3. Keeps it high-level (3-8 components max)
4. Uses the existing patterns and file structure from the codebase

Use this format:
\`\`\`mermaid
flowchart TD
    A[Component A] --> B[Component B]
    B --> C{Decision}
    C -->|Yes| D[Component D]
    C -->|No| E[Component E]
\`\`\`

Return ONLY the mermaid diagram content (including the flowchart TD line), no markdown code fences or explanations.`;
}

/**
 * Generate a fallback diagram when LLM fails
 */
export function generateFallbackDiagram(spec: SolutionSpecV2): ImplementationDiagram {
  const nodes: FlowchartNode[] = [
    { id: 'input', label: 'User Input' },
  ];

  const edges: FlowchartEdge[] = [];
  let prevId = 'input';

  // Add nodes for each scope item
  spec.scope.included.slice(0, 5).forEach((item, idx) => {
    const nodeId = `step${idx}`;
    nodes.push({ id: nodeId, label: item });
    edges.push({ from: prevId, to: nodeId });
    prevId = nodeId;
  });

  // Add output node
  nodes.push({ id: 'output', label: 'Result' });
  edges.push({ from: prevId, to: 'output' });

  const mermaid = createMermaidFlowchart(nodes, edges);

  return {
    type: 'flowchart',
    mermaid,
    description: 'Auto-generated fallback diagram based on scope items',
    generatedAt: Date.now(),
  };
}

/**
 * Create a Mermaid flowchart from node and edge definitions
 */
export function createMermaidFlowchart(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[]
): string {
  const lines: string[] = ['flowchart TD'];

  // Add node definitions
  for (const node of nodes) {
    const escapedLabel = escapeLabel(node.label);
    lines.push(`    ${node.id}[${escapedLabel}]`);
  }

  // Add edge definitions
  for (const edge of edges) {
    if (edge.label) {
      lines.push(`    ${edge.from} -->|${escapeLabel(edge.label)}| ${edge.to}`);
    } else {
      lines.push(`    ${edge.from} --> ${edge.to}`);
    }
  }

  return lines.join('\n');
}

/**
 * Escape special characters in Mermaid labels
 */
function escapeLabel(label: string): string {
  return label
    .replace(/"/g, "'")
    .replace(/&/g, 'and')
    .replace(/[<>]/g, '')
    .replace(/[\[\]{}]/g, '');
}
