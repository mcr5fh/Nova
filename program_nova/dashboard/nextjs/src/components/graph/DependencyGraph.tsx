'use client';

import { useMemo, useCallback } from 'react';
import { useNavigation } from '@/context';
import { formatDuration, formatCost } from '@/lib';
import type { StatusResponse, TaskStatus, TaskDefinition, Task, TokenUsage } from '@/types';

interface DependencyGraphProps {
  status: StatusResponse;
}

interface NodePosition {
  x: number;
  y: number;
  level: number;
}

interface Edge {
  from: string;
  to: string;
}

interface GraphData {
  levels: Record<number, string[]>;
  depths: Record<string, number>;
  edges: Edge[];
  nodePositions: Record<string, NodePosition>;
  width: number;
  height: number;
  maxLevel: number;
}

// Layout constants
const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;
const LEVEL_SPACING = 300;
const NODE_SPACING = 50;
const MARGIN = 60;

function computeCost(tokenUsage: TokenUsage | undefined): number {
  if (!tokenUsage) return 0;
  const inputCost = ((tokenUsage.input_tokens || 0) / 1_000_000) * 3;
  const outputCost = ((tokenUsage.output_tokens || 0) / 1_000_000) * 15;
  const cacheReadCost = ((tokenUsage.cache_read_tokens || 0) / 1_000_000) * 0.30;
  const cacheCreationCost = ((tokenUsage.cache_creation_tokens || 0) / 1_000_000) * 3.75;
  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}

function computeLiveDuration(startedAt: string | undefined): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  return Math.floor((Date.now() - start) / 1000);
}

function buildDependencyGraph(
  taskDefinitions: Record<string, TaskDefinition>,
): GraphData {
  // Calculate depth for each task (topological level)
  const depths: Record<string, number> = {};

  function calculateDepth(taskId: string): number {
    if (depths[taskId] !== undefined) {
      return depths[taskId];
    }

    const task = taskDefinitions[taskId];
    if (!task) {
      depths[taskId] = 0;
      return 0;
    }

    const dependencies = task.depends_on || [];
    if (dependencies.length === 0) {
      depths[taskId] = 0;
      return 0;
    }

    const depthValues = dependencies.map((dep) => calculateDepth(dep));
    depths[taskId] = Math.max(...depthValues) + 1;
    return depths[taskId];
  }

  // Calculate depths for all tasks
  for (const taskId in taskDefinitions) {
    calculateDepth(taskId);
  }

  // Group tasks by depth level
  const levels: Record<number, string[]> = {};
  for (const taskId in taskDefinitions) {
    const depth = depths[taskId];
    if (!levels[depth]) {
      levels[depth] = [];
    }
    levels[depth].push(taskId);
  }

  // Build edges
  const edges: Edge[] = [];
  for (const taskId in taskDefinitions) {
    const task = taskDefinitions[taskId];
    const dependencies = task.depends_on || [];

    for (const depId of dependencies) {
      edges.push({
        from: depId,
        to: taskId,
      });
    }
  }

  // Calculate dimensions
  const levelKeys = Object.keys(levels).map(Number);
  const maxLevel = levelKeys.length > 0 ? Math.max(...levelKeys) : 0;
  const maxNodesInLevel = Math.max(
    ...Object.values(levels).map((arr) => arr.length),
    1
  );

  const width = Math.max(1400, (maxLevel + 1) * LEVEL_SPACING + MARGIN * 2);
  const height = Math.max(
    800,
    maxNodesInLevel * (NODE_HEIGHT + NODE_SPACING) + MARGIN * 2
  );

  // Calculate node positions
  const nodePositions: Record<string, NodePosition> = {};

  for (const [level, taskIds] of Object.entries(levels)) {
    const levelNum = Number(level);
    const x = MARGIN + levelNum * LEVEL_SPACING;
    const totalHeight = taskIds.length * (NODE_HEIGHT + NODE_SPACING) - NODE_SPACING;
    const startY = (height - totalHeight) / 2;

    taskIds.forEach((taskId, index) => {
      const y = startY + index * (NODE_HEIGHT + NODE_SPACING);
      nodePositions[taskId] = { x, y, level: levelNum };
    });
  }

  return {
    levels,
    depths,
    edges,
    nodePositions,
    width,
    height,
    maxLevel,
  };
}

interface GraphNodeProps {
  taskId: string;
  position: NodePosition;
  taskDef: TaskDefinition;
  taskState: Task | undefined;
  onClick: () => void;
}

function GraphNode({ taskId, position, taskDef, taskState, onClick }: GraphNodeProps) {
  const status = taskState?.status || 'pending';
  const taskName = taskDef.name || '';
  const truncatedName = taskName.length > 30 ? taskName.substring(0, 27) + '...' : taskName;

  const duration =
    taskState?.status === 'in_progress'
      ? computeLiveDuration(taskState.started_at)
      : taskState?.duration_seconds || 0;
  const cost = computeCost(taskState?.token_usage);

  // Get fill and stroke classes based on status
  const getStatusStyles = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return {
          fill: 'rgba(16, 185, 129, 0.15)',
          stroke: 'var(--status-completed)',
        };
      case 'in_progress':
        return {
          fill: 'rgba(245, 158, 11, 0.15)',
          stroke: 'var(--status-in-progress)',
        };
      case 'failed':
        return {
          fill: 'rgba(239, 68, 68, 0.15)',
          stroke: 'var(--status-failed)',
        };
      case 'pending':
      default:
        return {
          fill: 'rgba(51, 65, 85, 0.6)',
          stroke: 'var(--status-pending)',
        };
    }
  };

  const statusStyles = getStatusStyles(status);

  return (
    <g
      className="cursor-pointer transition-all duration-300 hover:scale-[1.02]"
      onClick={onClick}
    >
      {/* Node rectangle */}
      <rect
        x={position.x}
        y={position.y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        style={{
          fill: statusStyles.fill,
          stroke: statusStyles.stroke,
          strokeWidth: status === 'in_progress' ? 3 : 2.5,
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
        }}
        className="hover:stroke-accent hover:stroke-[3px]"
      />

      {/* Task ID (prominent) */}
      <text
        x={position.x + NODE_WIDTH / 2}
        y={position.y + 28}
        textAnchor="middle"
        style={{
          fill: 'var(--accent)',
          fontSize: '18px',
          fontWeight: 700,
          pointerEvents: 'none',
        }}
      >
        {taskId}
      </text>

      {/* Task name (truncated) */}
      <text
        x={position.x + NODE_WIDTH / 2}
        y={position.y + 50}
        textAnchor="middle"
        style={{
          fill: 'var(--text-secondary)',
          fontSize: '13px',
          fontWeight: 400,
          pointerEvents: 'none',
        }}
      >
        {truncatedName}
      </text>

      {/* Metadata (duration and cost) */}
      <text
        x={position.x + NODE_WIDTH / 2}
        y={position.y + 72}
        textAnchor="middle"
        style={{
          fill: 'var(--text-secondary)',
          fontSize: '11px',
          fontWeight: 400,
          pointerEvents: 'none',
          opacity: 0.9,
        }}
      >
        {`${formatDuration(duration)} | ${formatCost(cost)}`}
      </text>
    </g>
  );
}

interface GraphEdgeProps {
  fromPos: NodePosition;
  toPos: NodePosition;
}

function GraphEdge({ fromPos, toPos }: GraphEdgeProps) {
  // Calculate path points
  const x1 = fromPos.x + NODE_WIDTH;
  const y1 = fromPos.y + NODE_HEIGHT / 2;
  const x2 = toPos.x;
  const y2 = toPos.y + NODE_HEIGHT / 2;

  // Create curved path using cubic bezier
  const midX = (x1 + x2) / 2;
  const pathData = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

  return (
    <path
      d={pathData}
      style={{
        stroke: 'var(--border-color)',
        strokeWidth: 2,
        fill: 'none',
        opacity: 0.6,
        markerEnd: 'url(#arrowhead)',
      }}
      className="transition-all duration-300 hover:stroke-accent hover:stroke-[3px] hover:opacity-100"
    />
  );
}

function Legend() {
  const items = [
    { label: 'Pending', color: 'var(--status-pending)' },
    { label: 'In Progress', color: 'var(--status-in-progress)' },
    { label: 'Completed', color: 'var(--status-completed)' },
    { label: 'Failed', color: 'var(--status-failed)' },
  ];

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-bg-secondary rounded-lg border border-border-color mt-4">
      <span className="text-text-secondary text-sm font-medium">Status:</span>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-text-secondary text-sm">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DependencyGraph({ status }: DependencyGraphProps) {
  const { showView } = useNavigation();
  const { task_definitions, tasks } = status;

  // Build graph data
  const graphData = useMemo(() => {
    if (!task_definitions || Object.keys(task_definitions).length === 0) {
      return null;
    }
    return buildDependencyGraph(task_definitions);
  }, [task_definitions]);

  // Handle node click - navigate to task detail
  const handleNodeClick = useCallback(
    (taskId: string) => {
      const taskDef = task_definitions[taskId];
      if (taskDef) {
        showView('l3', taskDef.branch, taskDef.group, taskId);
      }
    },
    [task_definitions, showView]
  );

  if (!graphData) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-text-secondary">
        Dependency information not available
      </div>
    );
  }

  const { edges, nodePositions, width, height, maxLevel } = graphData;

  return (
    <div className="w-full">
      <div
        className="overflow-auto bg-bg-secondary rounded-lg border border-border-color"
        style={{ maxHeight: '85vh' }}
      >
        <svg
          className="block min-h-[600px]"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Arrowhead marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3, 0 6"
                style={{
                  fill: 'var(--border-color)',
                  opacity: 0.8,
                }}
              />
            </marker>
          </defs>

          {/* Level labels */}
          <g>
            {Array.from({ length: maxLevel + 1 }, (_, level) => (
              <text
                key={`level-${level}`}
                x={MARGIN + level * LEVEL_SPACING + NODE_WIDTH / 2}
                y={MARGIN - 20}
                textAnchor="middle"
                style={{
                  fill: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                Level {level}
              </text>
            ))}
          </g>

          {/* Edges (drawn first so they appear behind nodes) */}
          <g>
            {edges.map((edge, index) => {
              const fromPos = nodePositions[edge.from];
              const toPos = nodePositions[edge.to];

              if (!fromPos || !toPos) return null;

              return (
                <GraphEdge
                  key={`edge-${index}`}
                  fromPos={fromPos}
                  toPos={toPos}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {Object.entries(nodePositions).map(([taskId, position]) => {
              const taskDef = task_definitions[taskId];
              const taskState = tasks[taskId];

              if (!taskDef) return null;

              return (
                <GraphNode
                  key={taskId}
                  taskId={taskId}
                  position={position}
                  taskDef={taskDef}
                  taskState={taskState}
                  onClick={() => handleNodeClick(taskId)}
                />
              );
            })}
          </g>
        </svg>
      </div>

      <Legend />
    </div>
  );
}
