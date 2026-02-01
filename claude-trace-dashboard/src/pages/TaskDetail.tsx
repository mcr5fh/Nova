import { Layout } from '@/components/Layout';
import { TaskTree } from '@/components/TaskTree';
import { TraceTable } from '@/components/TraceTable';
import { useTask, useTaskTree, useTraces, useTraceStream } from '@/api/hooks';
import { useUIStore } from '@/stores/uiStore';
import type { TaskTreeNode } from '@/types/api';
import type { TaskNode } from '@/components/TaskTree/types';

/**
 * TaskDetail - Detailed view for a specific task
 *
 * Features:
 * - Task summary with key metrics
 * - Interactive task tree visualization
 * - Task-specific trace table
 * - Real-time updates for the task
 */
export function TaskDetail() {
  const { selectedTaskId } = useUIStore();

  const { data: taskData, isLoading: taskLoading } = useTask(selectedTaskId || '');
  const { data: taskTreeData, isLoading: treeLoading } = useTaskTree(
    selectedTaskId || ''
  );
  const { data: tracesData, isLoading: tracesLoading } = useTraces({
    task_id: selectedTaskId || undefined,
  });

  // Enable real-time streaming for this task
  useTraceStream({
    taskId: selectedTaskId || undefined,
    enabled: !!selectedTaskId,
  });

  const traces = tracesData?.traces || [];

  // Convert TaskTreeNode to TaskNode format for TaskTree component
  const convertToTaskNode = (node: TaskTreeNode): TaskNode => {
    return {
      id: node.task_id,
      title: node.summary.task_description || node.task_id,
      type: 'task', // Default to task since API doesn't specify type
      status: mapStatus(node.summary.status),
      priority: 2, // Default priority
      assignee: undefined,
      created: new Date(node.summary.start_time).toISOString(),
      updated: new Date(node.summary.end_time || node.summary.start_time).toISOString(),
      parentId: node.parent_task_id || undefined,
      children: node.children?.map(convertToTaskNode),
    };
  };

  // Map API status to TaskTree status
  const mapStatus = (
    status: string
  ): 'open' | 'in_progress' | 'closed' | 'blocked' => {
    switch (status) {
      case 'pending':
        return 'open';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'closed';
      case 'failed':
      case 'blocked':
        return 'blocked';
      default:
        return 'open';
    }
  };

  const taskNodes: TaskNode[] = taskTreeData ? [convertToTaskNode(taskTreeData)] : [];

  if (!selectedTaskId) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-64">
          <p className="text-text-2">No task selected</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-0">Task Details</h1>
          <p className="text-sm text-text-2 mt-1 font-mono">{selectedTaskId}</p>
          {taskData?.task_description && (
            <p className="text-sm text-text-1 mt-2">{taskData.task_description}</p>
          )}
        </div>

        {/* Task Summary Stats */}
        {taskLoading ? (
          <div className="text-text-2">Loading task summary...</div>
        ) : taskData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">Status</p>
              <p className="text-lg font-bold text-text-0 capitalize">
                {taskData.status.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">Cost</p>
              <p className="text-lg font-bold text-text-0">
                ${taskData.total_cost.toFixed(4)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">Tokens</p>
              <p className="text-lg font-bold text-text-0">
                {taskData.total_tokens.toLocaleString()}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Tool Calls
              </p>
              <p className="text-lg font-bold text-text-0">{taskData.tool_calls}</p>
            </div>
          </div>
        ) : null}

        {/* Task Tree */}
        {treeLoading ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-text-2">Loading task tree...</div>
          </div>
        ) : taskNodes.length > 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <TaskTree tasks={taskNodes} />
          </div>
        ) : null}

        {/* Task Traces */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-text-0 mb-4">Task Traces</h2>
          <TraceTable traces={traces} isLoading={tracesLoading} />
        </div>
      </div>
    </Layout>
  );
}
