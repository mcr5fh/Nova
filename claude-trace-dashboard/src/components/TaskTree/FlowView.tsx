import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { FlowViewProps, TaskNode } from './types';
import { getStatusColor, getTaskTypeIcon, flattenTaskTree } from './utils';
import { TaskNodeComponent } from './TaskNodeComponent';

const elk = new ELK();

// ELK layout options
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '80',
  'elk.direction': 'DOWN',
};

interface LayoutedNode extends Node {
  position: { x: number; y: number };
}

/**
 * Convert TaskNode tree to React Flow nodes and edges with ELK layout
 */
async function layoutTaskTree(tasks: TaskNode[]): Promise<{
  nodes: LayoutedNode[];
  edges: Edge[];
}> {
  const flatTasks = flattenTaskTree(tasks);
  const nodeMap = new Map(flatTasks.map(t => [t.id, t]));

  // Build nodes for ELK
  const elkNodes = flatTasks.map(task => ({
    id: task.id,
    width: 250,
    height: 100,
  }));

  // Build edges for ELK (parent-child + dependencies)
  const elkEdges: { id: string; sources: string[]; targets: string[] }[] = [];

  flatTasks.forEach(task => {
    // Parent-child edges
    if (task.children) {
      task.children.forEach(child => {
        elkEdges.push({
          id: `${task.id}-${child.id}`,
          sources: [task.id],
          targets: [child.id],
        });
      });
    }

    // Dependency edges
    if (task.dependsOn) {
      task.dependsOn.forEach(depId => {
        elkEdges.push({
          id: `dep-${depId}-${task.id}`,
          sources: [depId],
          targets: [task.id],
        });
      });
    }
  });

  // Run ELK layout
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: elkOptions,
    children: elkNodes,
    edges: elkEdges,
  });

  // Convert to React Flow format
  const nodes: LayoutedNode[] = (graph.children || []).map(node => {
    const task = nodeMap.get(node.id);
    if (!task) throw new Error(`Task not found: ${node.id}`);

    return {
      id: node.id,
      type: 'taskNode',
      position: { x: node.x || 0, y: node.y || 0 },
      data: {
        task,
        icon: getTaskTypeIcon(task.type),
        color: getStatusColor(task.status),
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  const edges: Edge[] = [];

  // Parent-child edges (solid)
  flatTasks.forEach(task => {
    if (task.children) {
      task.children.forEach(child => {
        edges.push({
          id: `${task.id}-${child.id}`,
          source: task.id,
          target: child.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#64748b', strokeWidth: 2 },
        });
      });
    }

    // Dependency edges (dashed)
    if (task.dependsOn) {
      task.dependsOn.forEach(depId => {
        edges.push({
          id: `dep-${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5,5' },
          label: 'depends',
          labelStyle: { fontSize: 10, fill: '#64748b' },
        });
      });
    }
  });

  return { nodes, edges };
}

export function FlowView({ tasks, onTaskClick, onTaskHover }: FlowViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      taskNode: TaskNodeComponent,
    }),
    []
  );

  // Layout tasks on mount or when tasks change
  useEffect(() => {
    let isMounted = true;

    const doLayout = async () => {
      if (tasks.length === 0) {
        if (isMounted) {
          setNodes([]);
          setEdges([]);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const { nodes, edges } = await layoutTaskTree(tasks);
        if (isMounted) {
          setNodes(nodes);
          setEdges(edges);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Layout error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to layout graph');
          setIsLoading(false);
        }
      }
    };

    doLayout();

    return () => {
      isMounted = false;
    };
  }, [tasks, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onTaskClick) {
        onTaskClick(node.id);
      }
    },
    [onTaskClick]
  );

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onTaskHover) {
        onTaskHover(node.id);
      }
    },
    [onTaskHover]
  );

  const handleNodeMouseLeave = useCallback(() => {
    if (onTaskHover) {
      onTaskHover(null);
    }
  }, [onTaskHover]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] text-slate-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mx-auto mb-4"></div>
          <p>Layouting task tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] text-red-500">
        <div>
          <p className="font-semibold">Failed to render graph</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] text-slate-500">
        No tasks to display
      </div>
    );
  }

  return (
    <div className="flow-view w-full h-[600px] border border-slate-700 rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#64748b" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as { color?: string };
            return data.color || '#94a3b8';
          }}
          maskColor="rgba(0, 0, 0, 0.2)"
        />
      </ReactFlow>
    </div>
  );
}
