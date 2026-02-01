import { useMemo, useState } from "react";
import type { TaskNode, TaskEdge } from "@/types/task";
import { getStatusLabel } from "@/utils/task-utils";

interface NetworkViewProps {
  tasks: TaskNode[];
  edges: TaskEdge[];
}

interface NetworkNode {
  task: TaskNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_RADIUS = 40;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const SPRING_LENGTH = 150;
const SPRING_STRENGTH = 0.05;
const REPULSION_STRENGTH = 5000;
const DAMPING = 0.8;

/**
 * Simple force-directed layout simulation
 */
function simulateLayout(
  tasks: TaskNode[],
  edges: TaskEdge[],
  iterations: number = 100
): NetworkNode[] {
  // Initialize nodes with random positions
  const nodes: NetworkNode[] = tasks.map(task => ({
    task,
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    vx: 0,
    vy: 0,
  }));

  const nodeMap = new Map(nodes.map((n, i) => [n.task.id, i]));

  for (let iter = 0; iter < iterations; iter++) {
    // Reset forces
    nodes.forEach(node => {
      node.vx = 0;
      node.vy = 0;
    });

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = REPULSION_STRENGTH / (dist * dist);

        nodeA.vx -= (dx / dist) * force;
        nodeA.vy -= (dy / dist) * force;
        nodeB.vx += (dx / dist) * force;
        nodeB.vy += (dy / dist) * force;
      }
    }

    // Spring forces for edges
    edges.forEach(edge => {
      const sourceIdx = nodeMap.get(edge.source);
      const targetIdx = nodeMap.get(edge.target);

      if (sourceIdx === undefined || targetIdx === undefined) return;

      const source = nodes[sourceIdx];
      const target = nodes[targetIdx];

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;

      source.vx += (dx / dist) * force;
      source.vy += (dy / dist) * force;
      target.vx -= (dx / dist) * force;
      target.vy -= (dy / dist) * force;
    });

    // Update positions with damping
    nodes.forEach(node => {
      node.x += node.vx * DAMPING;
      node.y += node.vy * DAMPING;

      // Keep nodes within bounds
      node.x = Math.max(NODE_RADIUS + 20, Math.min(CANVAS_WIDTH - NODE_RADIUS - 20, node.x));
      node.y = Math.max(NODE_RADIUS + 20, Math.min(CANVAS_HEIGHT - NODE_RADIUS - 20, node.y));
    });
  }

  return nodes;
}

/**
 * Group nodes by status for cluster coloring
 */
function getClusterColor(status: string): string {
  const colors: Record<string, string> = {
    queued: "hsl(var(--muted))",
    running: "hsl(220 80% 60%)",
    blocked: "hsl(40 90% 60%)",
    escalated: "hsl(25 90% 60%)",
    needs_human: "hsl(280 80% 60%)",
    failed: "hsl(0 80% 60%)",
    done: "hsl(140 70% 50%)",
  };
  return colors[status] || "hsl(var(--muted))";
}

export function NetworkView({ tasks, edges }: NetworkViewProps) {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const nodes = useMemo(() => {
    return simulateLayout(tasks, edges);
  }, [tasks, edges]);

  const nodeMap = useMemo(() => {
    return new Map(nodes.map(n => [n.task.id, n]));
  }, [nodes]);

  return (
    <div className="w-full h-full overflow-auto bg-background/50 rounded-lg">
      <svg
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="min-h-[600px]"
      >
        {/* Render edges */}
        <g className="edges">
          {edges.map(edge => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);

            if (!source || !target) return null;

            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                opacity={0.2}
                className="transition-opacity hover:opacity-60"
              />
            );
          })}
        </g>

        {/* Render nodes */}
        <g className="nodes">
          {nodes.map(node => {
            const statusLabel = getStatusLabel(node.task.status);
            const clusterColor = getClusterColor(node.task.status);
            const isHovered = hoveredTask === node.task.id;

            return (
              <g
                key={node.task.id}
                onMouseEnter={() => setHoveredTask(node.task.id)}
                onMouseLeave={() => setHoveredTask(null)}
                className="cursor-pointer"
              >
                {/* Cluster glow */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS + 5}
                  fill={clusterColor}
                  opacity={isHovered ? 0.3 : 0.15}
                  className="transition-all duration-200"
                />

                {/* Node background */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth={isHovered ? "3" : "2"}
                  className="transition-all duration-200"
                />

                {/* Status indicator ring */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS - 5}
                  fill="none"
                  stroke={clusterColor}
                  strokeWidth="3"
                  opacity={0.6}
                />

                {/* Task size */}
                <text
                  x={node.x}
                  y={node.y - 5}
                  fontSize="20"
                  fontWeight="700"
                  textAnchor="middle"
                  className="fill-foreground"
                >
                  {node.task.size}
                </text>

                {/* Task ID */}
                <text
                  x={node.x}
                  y={node.y + 10}
                  fontSize="10"
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontWeight="500"
                >
                  {node.task.id}
                </text>

                {/* Attempts indicator */}
                <text
                  x={node.x}
                  y={node.y + 22}
                  fontSize="9"
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontFamily="monospace"
                >
                  {node.task.attempts}/{node.task.maxAttempts}
                </text>

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    {/* Tooltip background */}
                    <rect
                      x={node.x - 120}
                      y={node.y - NODE_RADIUS - 70}
                      width="240"
                      height="60"
                      rx="6"
                      fill="hsl(var(--popover))"
                      stroke="hsl(var(--border))"
                      strokeWidth="1.5"
                    />

                    {/* Spec */}
                    <foreignObject
                      x={node.x - 110}
                      y={node.y - NODE_RADIUS - 65}
                      width="220"
                      height="35"
                    >
                      <div className="text-xs text-foreground leading-tight line-clamp-2 font-medium">
                        {node.task.spec}
                      </div>
                    </foreignObject>

                    {/* Status */}
                    <text
                      x={node.x - 110}
                      y={node.y - NODE_RADIUS - 22}
                      fontSize="10"
                      className="fill-muted-foreground"
                    >
                      Status: {statusLabel}
                    </text>

                    {/* Model */}
                    {node.task.workerModel && (
                      <text
                        x={node.x - 110}
                        y={node.y - NODE_RADIUS - 10}
                        fontSize="9"
                        className="fill-muted-foreground"
                        fontFamily="monospace"
                      >
                        {node.task.workerModel}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Legend */}
        <g transform="translate(20, 20)">
          <rect width="180" height="160" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" opacity="0.9" />
          <text x="10" y="20" fontSize="12" fontWeight="600" className="fill-foreground">
            Status Clusters
          </text>
          {[
            { status: "done", label: "Done" },
            { status: "running", label: "Running" },
            { status: "queued", label: "Queued" },
            { status: "blocked", label: "Blocked" },
            { status: "escalated", label: "Escalated" },
            { status: "needs_human", label: "Needs Human" },
            { status: "failed", label: "Failed" },
          ].map((item, i) => (
            <g key={item.status} transform={`translate(10, ${40 + i * 18})`}>
              <circle cx="6" cy="-3" r="5" fill={getClusterColor(item.status)} />
              <text x="18" y="0" fontSize="11" className="fill-foreground">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
