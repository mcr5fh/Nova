import { useMemo, useState } from "react";
import type { TaskNode, TaskEdge } from "@/types/task";
import { getStatusColor, getStatusLabel } from "@/utils/task-utils";

interface HierarchicalTreeProps {
  tasks: TaskNode[];
  edges: TaskEdge[];
}

interface TreeNode {
  task: TaskNode;
  children: TreeNode[];
  x: number;
  y: number;
  level: number;
}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 120;
const HORIZONTAL_SPACING = 50;
const VERTICAL_SPACING = 150;

/**
 * Build a tree structure from tasks and edges
 */
function buildTree(tasks: TaskNode[], edges: TaskEdge[]): TreeNode[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const childrenMap = new Map<string, string[]>();

  // Build parent-child relationships
  edges.forEach(edge => {
    const children = childrenMap.get(edge.source) || [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
  });

  // Find root nodes (nodes with no incoming edges)
  const targetIds = new Set(edges.map(e => e.target));
  const rootIds = tasks.filter(t => !targetIds.has(t.id)).map(t => t.id);

  // Recursively build tree
  function buildNode(taskId: string, level: number): TreeNode | null {
    const task = taskMap.get(taskId);
    if (!task) return null;

    const childIds = childrenMap.get(taskId) || [];
    const children = childIds
      .map(childId => buildNode(childId, level + 1))
      .filter((n): n is TreeNode => n !== null);

    return {
      task,
      children,
      x: 0,
      y: 0,
      level,
    };
  }

  const roots = rootIds
    .map(id => buildNode(id, 0))
    .filter((n): n is TreeNode => n !== null);

  return roots;
}

/**
 * Calculate positions for tree nodes using a simple layout algorithm
 */
function layoutTree(roots: TreeNode[]): TreeNode[] {
  let nextX = 0;

  function layout(node: TreeNode, startX: number): number {
    if (node.children.length === 0) {
      node.x = startX;
      node.y = node.level * VERTICAL_SPACING;
      return startX + NODE_WIDTH + HORIZONTAL_SPACING;
    }

    // Layout children first
    let childX = startX;
    node.children.forEach(child => {
      childX = layout(child, childX);
    });

    // Center parent over children
    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];
    node.x = (firstChild.x + lastChild.x) / 2;
    node.y = node.level * VERTICAL_SPACING;

    return childX;
  }

  roots.forEach(root => {
    nextX = layout(root, nextX);
  });

  return roots;
}

/**
 * Generate SVG path for connection between parent and child
 */
function getConnectionPath(parent: TreeNode, child: TreeNode): string {
  const x1 = parent.x + NODE_WIDTH / 2;
  const y1 = parent.y + NODE_HEIGHT;
  const x2 = child.x + NODE_WIDTH / 2;
  const y2 = child.y;

  const midY = (y1 + y2) / 2;

  return `M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`;
}

/**
 * Collect all nodes for rendering
 */
function collectNodes(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(node: TreeNode) {
    result.push(node);
    node.children.forEach(traverse);
  }

  roots.forEach(traverse);
  return result;
}

export function HierarchicalTree({ tasks, edges }: HierarchicalTreeProps) {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const { allNodes, viewBox } = useMemo(() => {
    const treeRoots = buildTree(tasks, edges);
    const layoutedRoots = layoutTree(treeRoots);
    const nodes = collectNodes(layoutedRoots);

    // Calculate viewBox
    const maxX = Math.max(...nodes.map(n => n.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map(n => n.y + NODE_HEIGHT));

    return {
      roots: layoutedRoots,
      allNodes: nodes,
      viewBox: `0 0 ${maxX + 50} ${maxY + 50}`,
    };
  }, [tasks, edges]);

  return (
    <div className="w-full h-full overflow-auto bg-background/50 rounded-lg">
      <svg width="100%" height="100%" viewBox={viewBox} className="min-h-[600px]">
        {/* Render connections */}
        <g className="connections">
          {allNodes.map(node =>
            node.children.map(child => (
              <path
                key={`${node.task.id}-${child.task.id}`}
                d={getConnectionPath(node, child)}
                className="stroke-muted-foreground transition-all duration-200 hover:opacity-100 hover:stroke-primary"
                strokeWidth="2"
                fill="none"
                opacity={0.3}
              />
            ))
          )}
        </g>

        {/* Render nodes */}
        <g className="nodes">
          {allNodes.map(node => {
            const statusColor = getStatusColor(node.task.status);
            const statusLabel = getStatusLabel(node.task.status);
            const isHovered = hoveredTask === node.task.id;

            return (
              <g
                key={node.task.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredTask(node.task.id)}
                onMouseLeave={() => setHoveredTask(null)}
                className="cursor-pointer"
              >
                {/* Background */}
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="8"
                  className="fill-card stroke-border transition-all duration-200"
                  strokeWidth={isHovered ? "3" : "1"}
                  opacity={isHovered ? 1 : 0.9}
                />

                {/* Status indicator */}
                <circle
                  cx="15"
                  cy="15"
                  r="6"
                  className={statusColor.replace('bg-', 'fill-')}
                />

                {/* Task ID */}
                <text
                  x="30"
                  y="20"
                  fontSize="12"
                  fontWeight="500"
                  className="fill-foreground"
                >
                  {node.task.id}
                </text>

                {/* Size badge */}
                <rect
                  x={NODE_WIDTH - 35}
                  y="8"
                  width="28"
                  height="18"
                  rx="4"
                  className="fill-muted stroke-border"
                />
                <text
                  x={NODE_WIDTH - 21}
                  y="20"
                  fontSize="10"
                  textAnchor="middle"
                  className="fill-foreground"
                  fontWeight="500"
                >
                  {node.task.size}
                </text>

                {/* Spec text */}
                <foreignObject x="10" y="35" width={NODE_WIDTH - 20} height="45">
                  <div className="text-sm text-foreground leading-tight line-clamp-2 px-1">
                    {node.task.spec}
                  </div>
                </foreignObject>

                {/* Status and attempts */}
                <text
                  x="10"
                  y="95"
                  fontSize="11"
                  className="fill-muted-foreground"
                >
                  {statusLabel}
                </text>
                <text
                  x={NODE_WIDTH - 10}
                  y="95"
                  fontSize="11"
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontFamily="monospace"
                >
                  {node.task.attempts}/{node.task.maxAttempts}
                </text>

                {/* Telemetry (if available) */}
                {node.task.telemetry && (
                  <text
                    x="10"
                    y="110"
                    fontSize="10"
                    className="fill-muted-foreground"
                    fontFamily="monospace"
                  >
                    {node.task.telemetry.tokens.toLocaleString()} tokens · ${node.task.telemetry.cost.toFixed(4)}
                  </text>
                )}

                {/* Hover tooltip */}
                {isHovered && node.task.workerModel && (
                  <g>
                    <rect
                      x="-10"
                      y={NODE_HEIGHT + 5}
                      width={NODE_WIDTH + 20}
                      height="25"
                      rx="4"
                      className="fill-popover stroke-border"
                    />
                    <text
                      x={NODE_WIDTH / 2}
                      y={NODE_HEIGHT + 20}
                      fontSize="10"
                      textAnchor="middle"
                      className="fill-popover-foreground"
                    >
                      Model: {node.task.workerModel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
