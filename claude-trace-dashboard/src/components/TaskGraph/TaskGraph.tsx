import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import type { TaskNode, TaskEdge } from "@/types/task";
import { TaskNodeComponent } from "./TaskNodeComponent";
import { getStatusColor } from "@/utils/task-utils";
import "@xyflow/react/dist/style.css";

const elk = new ELK();

// ELK layout options for hierarchical tree layout
const elkOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "50",
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  "elk.spacing.edgeNode": "30",
};

const nodeTypes = {
  task: TaskNodeComponent,
};

interface TaskGraphProps {
  tasks: TaskNode[];
  edges: TaskEdge[];
}

/**
 * Convert task nodes to React Flow nodes with ELK layout
 */
async function getLayoutedElements(
  tasks: TaskNode[],
  edges: TaskEdge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const graph = {
    id: "root",
    layoutOptions: elkOptions,
    children: tasks.map((task) => ({
      id: task.id,
      width: 250,
      height: 120,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);

  const nodes: Node[] = (layoutedGraph.children || []).map((node) => ({
    id: node.id,
    type: "task",
    position: { x: node.x || 0, y: node.y || 0 },
    data: tasks.find((t) => t.id === node.id)!,
  }));

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: edge.type === "dependency",
  }));

  return { nodes, edges: flowEdges };
}

export function TaskGraph({ tasks, edges }: TaskGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Apply layout when tasks or edges change
  useEffect(() => {
    let mounted = true;

    async function applyLayout() {
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(tasks, edges);
      if (mounted) {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      }
    }

    applyLayout();

    return () => {
      mounted = false;
    };
  }, [tasks, edges, setNodes, setEdges]);

  // Minimap node color based on task status
  const minimapNodeColor = useCallback((node: Node) => {
    const task = node.data as TaskNode;
    const colorClass = getStatusColor(task.status);
    // Extract Tailwind color to hex (simplified mapping)
    const colorMap: Record<string, string> = {
      "bg-gray-400": "#9ca3af",
      "bg-blue-500": "#3b82f6",
      "bg-yellow-500": "#eab308",
      "bg-orange-500": "#f97316",
      "bg-purple-500": "#a855f7",
      "bg-red-500": "#ef4444",
      "bg-green-500": "#22c55e",
    };
    return colorMap[colorClass] || "#9ca3af";
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={flowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
    >
      <Background />
      <Controls />
      <MiniMap nodeColor={minimapNodeColor} />
    </ReactFlow>
  );
}
