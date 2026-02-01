import { useMemo, useState } from "react";
import type { TaskNode, TaskEdge } from "@/types/task";
import { getStatusColor, getStatusLabel } from "@/utils/task-utils";

interface TimelineFlowProps {
  tasks: TaskNode[];
  edges: TaskEdge[];
}

interface TimelineNode {
  task: TaskNode;
  lane: number;
  startX: number;
  width: number;
}

const LANE_HEIGHT = 100;
const LANE_PADDING = 20;
const NODE_HEIGHT = 80;
const TIMELINE_START = 100;

/**
 * Assign tasks to horizontal lanes based on dependencies
 */
function assignLanes(tasks: TaskNode[], edges: TaskEdge[]): TimelineNode[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const dependencyMap = new Map<string, Set<string>>();

  // Build dependency map (what depends on this task)
  edges.forEach(edge => {
    const deps = dependencyMap.get(edge.source) || new Set();
    deps.add(edge.target);
    dependencyMap.set(edge.source, deps);
  });

  // Find tasks with no dependencies (roots)
  const targetIds = new Set(edges.map(e => e.target));
  const rootIds = tasks.filter(t => !targetIds.has(t.id)).map(t => t.id);

  const laneAssignments = new Map<string, string>();
  const processedTasks = new Set<string>();
  const timeline: TimelineNode[] = [];

  let currentX = TIMELINE_START;

  // Process tasks in waves (level-order traversal)
  function processWave(taskIds: string[], currentLane: number): string[] {
    const nextWave: string[] = [];
    let maxLane = currentLane;

    taskIds.forEach(taskId => {
      if (processedTasks.has(taskId)) return;

      const task = taskMap.get(taskId);
      if (!task) return;

      // Find an available lane
      let lane = currentLane;
      while (laneAssignments.has(`${currentX}-${lane}`)) {
        lane++;
      }

      maxLane = Math.max(maxLane, lane);

      // Calculate node width based on task size
      const sizeWidths: Record<string, number> = {
        XS: 80,
        S: 120,
        M: 160,
        L: 200,
        XL: 240,
      };
      const width = sizeWidths[task.size] || 120;

      laneAssignments.set(`${currentX}-${lane}`, taskId);
      processedTasks.add(taskId);

      timeline.push({
        task,
        lane,
        startX: currentX,
        width,
      });

      // Add dependencies to next wave
      const deps = dependencyMap.get(taskId);
      if (deps) {
        deps.forEach(depId => {
          if (!processedTasks.has(depId)) {
            nextWave.push(depId);
          }
        });
      }
    });

    return nextWave;
  }

  // Process tasks wave by wave
  let currentWave = rootIds;

  while (currentWave.length > 0) {
    currentWave = processWave(currentWave, 0);
    currentX += 250; // Move to next time column
  }

  return timeline;
}

export function TimelineFlow({ tasks, edges }: TimelineFlowProps) {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const { timelineNodes, maxLane, maxX, connections } = useMemo(() => {
    const nodes = assignLanes(tasks, edges);
    const maxLaneNum = Math.max(...nodes.map(n => n.lane), 0);
    const maxXPos = Math.max(...nodes.map(n => n.startX + n.width)) + 50;

    const nodeMap = new Map(nodes.map(n => [n.task.id, n]));

    // Calculate connection paths
    const conns = edges
      .map(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;

        const x1 = source.startX + source.width;
        const y1 = LANE_PADDING + source.lane * LANE_HEIGHT + NODE_HEIGHT / 2;
        const x2 = target.startX;
        const y2 = LANE_PADDING + target.lane * LANE_HEIGHT + NODE_HEIGHT / 2;

        return { edge, x1, y1, x2, y2 };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return {
      timelineNodes: nodes,
      maxLane: maxLaneNum,
      maxX: maxXPos,
      connections: conns,
    };
  }, [tasks, edges]);

  const svgHeight = (maxLane + 1) * LANE_HEIGHT + 2 * LANE_PADDING;

  return (
    <div className="w-full h-full overflow-auto bg-background/50 rounded-lg">
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${maxX} ${svgHeight}`}
        className="min-h-[600px]"
      >
        {/* Lane backgrounds */}
        <g className="lanes">
          {Array.from({ length: maxLane + 1 }).map((_, i) => (
            <rect
              key={i}
              x="0"
              y={LANE_PADDING + i * LANE_HEIGHT}
              width={maxX}
              height={LANE_HEIGHT}
              fill={i % 2 === 0 ? "hsl(var(--muted))" : "hsl(var(--card))"}
              opacity={0.3}
            />
          ))}
        </g>

        {/* Time axis */}
        <line
          x1={TIMELINE_START}
          y1={LANE_PADDING}
          x2={TIMELINE_START}
          y2={svgHeight - LANE_PADDING}
          stroke="hsl(var(--border))"
          strokeWidth="2"
          strokeDasharray="5,5"
        />

        {/* Connections */}
        <g className="connections">
          {connections.map(({ edge, x1, y1, x2, y2 }) => {
            const midX = (x1 + x2) / 2;
            return (
              <path
                key={edge.id}
                d={`M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                fill="none"
                opacity={0.3}
                markerEnd="url(#arrowhead)"
                className="transition-all duration-200 hover:opacity-100 hover:stroke-primary"
              />
            );
          })}
        </g>

        {/* Arrow marker definition */}
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
              fill="hsl(var(--muted-foreground))"
              opacity="0.5"
            />
          </marker>
        </defs>

        {/* Task nodes */}
        <g className="nodes">
          {timelineNodes.map(node => {
            const statusColor = getStatusColor(node.task.status);
            const statusLabel = getStatusLabel(node.task.status);
            const isHovered = hoveredTask === node.task.id;
            const y = LANE_PADDING + node.lane * LANE_HEIGHT + (LANE_HEIGHT - NODE_HEIGHT) / 2;

            return (
              <g
                key={node.task.id}
                transform={`translate(${node.startX}, ${y})`}
                onMouseEnter={() => setHoveredTask(node.task.id)}
                onMouseLeave={() => setHoveredTask(null)}
                className="cursor-pointer"
              >
                {/* Node background */}
                <rect
                  width={node.width}
                  height={NODE_HEIGHT}
                  rx="8"
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth={isHovered ? "3" : "1.5"}
                  className="transition-all duration-200"
                  opacity={isHovered ? 1 : 0.95}
                />

                {/* Status bar on left */}
                <rect
                  width="6"
                  height={NODE_HEIGHT}
                  rx="8 0 0 8"
                  className={statusColor}
                />

                {/* Task ID */}
                <text
                  x="15"
                  y="20"
                  fontSize="11"
                  fontWeight="600"
                  className="fill-foreground"
                >
                  {node.task.id}
                </text>

                {/* Size badge */}
                <rect
                  x={node.width - 30}
                  y="8"
                  width="22"
                  height="16"
                  rx="3"
                  fill="hsl(var(--muted))"
                />
                <text
                  x={node.width - 19}
                  y="19"
                  fontSize="9"
                  textAnchor="middle"
                  className="fill-foreground"
                  fontWeight="600"
                >
                  {node.task.size}
                </text>

                {/* Spec text */}
                <foreignObject x="15" y="28" width={node.width - 30} height="28">
                  <div className="text-xs text-foreground leading-tight line-clamp-2">
                    {node.task.spec}
                  </div>
                </foreignObject>

                {/* Status and attempts */}
                <text
                  x="15"
                  y={NODE_HEIGHT - 10}
                  fontSize="10"
                  className="fill-muted-foreground"
                >
                  {statusLabel}
                </text>
                <text
                  x={node.width - 15}
                  y={NODE_HEIGHT - 10}
                  fontSize="10"
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontFamily="monospace"
                >
                  {node.task.attempts}/{node.task.maxAttempts}
                </text>

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x="-5"
                      y={NODE_HEIGHT + 5}
                      width={node.width + 10}
                      height="40"
                      rx="4"
                      fill="hsl(var(--popover))"
                      stroke="hsl(var(--border))"
                    />

                    {node.task.workerModel && (
                      <text
                        x="5"
                        y={NODE_HEIGHT + 20}
                        fontSize="10"
                        className="fill-popover-foreground"
                      >
                        Model: {node.task.workerModel}
                      </text>
                    )}

                    {node.task.telemetry && (
                      <text
                        x="5"
                        y={NODE_HEIGHT + 35}
                        fontSize="9"
                        className="fill-muted-foreground"
                        fontFamily="monospace"
                      >
                        {node.task.telemetry.tokens.toLocaleString()} tokens · $
                        {node.task.telemetry.cost.toFixed(4)}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Timeline labels */}
        <g className="timeline-labels">
          <text x="10" y="15" fontSize="11" fontWeight="600" className="fill-foreground">
            Timeline Flow
          </text>
          <text
            x={TIMELINE_START}
            y="15"
            fontSize="10"
            textAnchor="middle"
            className="fill-muted-foreground"
          >
            Start
          </text>
        </g>
      </svg>
    </div>
  );
}
