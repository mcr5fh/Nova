import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { MermaidViewProps } from './types';
import { buildMermaidDiagram } from './utils';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
});

export function MermaidView({ tasks, onTaskClick }: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return;

    const renderDiagram = async () => {
      try {
        setError(null);
        const diagram = buildMermaidDiagram(tasks);

        // Create a unique ID for this render
        const id = `mermaid-${Date.now()}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, diagram);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;

          // Add click handlers to nodes
          if (onTaskClick) {
            const nodes = containerRef.current.querySelectorAll('.node');
            nodes.forEach((node) => {
              const nodeElement = node as HTMLElement;
              nodeElement.style.cursor = 'pointer';

              nodeElement.addEventListener('click', (e) => {
                e.preventDefault();
                // Extract task ID from the node's text content
                const text = nodeElement.textContent || '';
                const match = text.match(/Nova-[\w\d.]+/);
                if (match) {
                  onTaskClick(match[0]);
                }
              });
            });
          }
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [tasks, onTaskClick]);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No tasks to display
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <div>
          <p className="font-semibold">Failed to render diagram</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-view w-full overflow-auto">
      <div ref={containerRef} className="min-h-[400px] p-4" />
    </div>
  );
}
