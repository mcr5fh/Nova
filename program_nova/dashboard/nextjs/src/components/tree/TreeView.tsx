'use client';

import { useNavigation } from '@/context';
import { TreeNode } from './TreeNode';
import type { StatusResponse, TaskStatus, Task } from '@/types';

interface TreeViewProps {
  status: StatusResponse;
}

/**
 * Computes the aggregate status for an L1 branch based on its tasks
 */
function computeL1Status(
  l2Groups: Record<string, string[]>,
  tasks: Record<string, Task>
): TaskStatus {
  const allTaskIds = Object.values(l2Groups).flat();

  // If any task is failed, the branch is failed
  if (allTaskIds.some((id) => tasks[id]?.status === 'failed')) {
    return 'failed';
  }

  // If any task is in_progress, the branch is in_progress
  if (allTaskIds.some((id) => tasks[id]?.status === 'in_progress')) {
    return 'in_progress';
  }

  // If all tasks are completed, the branch is completed
  if (allTaskIds.every((id) => tasks[id]?.status === 'completed')) {
    return 'completed';
  }

  // Otherwise, pending
  return 'pending';
}

/**
 * Computes the aggregate status for an L2 group based on its tasks
 */
function computeL2Status(
  taskIds: string[],
  tasks: Record<string, Task>
): TaskStatus {
  // If any task is failed, the group is failed
  if (taskIds.some((id) => tasks[id]?.status === 'failed')) {
    return 'failed';
  }

  // If any task is in_progress, the group is in_progress
  if (taskIds.some((id) => tasks[id]?.status === 'in_progress')) {
    return 'in_progress';
  }

  // If all tasks are completed, the group is completed
  if (taskIds.every((id) => tasks[id]?.status === 'completed')) {
    return 'completed';
  }

  // Otherwise, pending
  return 'pending';
}

/**
 * Gets the duration for a task, accounting for in-progress tasks
 */
function getTaskDuration(task: Task | undefined): number {
  if (!task) return 0;

  if (task.status === 'in_progress' && task.started_at) {
    // Calculate elapsed time for in-progress tasks
    const startTime = new Date(task.started_at).getTime();
    const now = Date.now();
    return Math.floor((now - startTime) / 1000);
  }

  return task.duration_seconds || 0;
}

export function TreeView({ status }: TreeViewProps) {
  const { showView } = useNavigation();
  const { hierarchy, rollups, tasks } = status;

  // Early return if data is missing
  if (!hierarchy || !rollups || !tasks) {
    return (
      <div className="bg-bg-secondary border border-border-color rounded-lg p-4">
        <p className="text-text-secondary text-sm">
          Unable to render tree view: missing data
        </p>
      </div>
    );
  }

  const l1Names = Object.keys(hierarchy);

  if (l1Names.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border-color rounded-lg p-4">
        <p className="text-text-secondary text-sm">
          No branches to display
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border-color rounded-lg p-4 overflow-auto max-h-[500px]">
      {l1Names.map((l1Name) => {
        const l2Groups = hierarchy[l1Name];
        const l1Rollup = rollups.l1_rollups?.[l1Name];

        // Skip if no L2 groups
        if (!l2Groups) return null;

        return (
          <TreeNode
            key={l1Name}
            label={l1Name}
            level={0}
            status={computeL1Status(l2Groups, tasks)}
            meta={l1Rollup ? {
              duration: l1Rollup.duration_seconds,
              cost: l1Rollup.cost_usd,
            } : undefined}
            onClick={() => showView('l1', l1Name)}
          >
            {Object.entries(l2Groups).map(([l2Name, taskIds]) => {
              const l2Rollup = rollups.l2_rollups?.[l1Name]?.[l2Name];

              return (
                <TreeNode
                  key={`${l1Name}-${l2Name}`}
                  label={l2Name}
                  level={1}
                  status={computeL2Status(taskIds, tasks)}
                  meta={l2Rollup ? {
                    duration: l2Rollup.duration_seconds,
                    cost: l2Rollup.cost_usd,
                  } : undefined}
                  onClick={() => showView('l2', l1Name, l2Name)}
                >
                  {taskIds.map((taskId) => {
                    const task = tasks[taskId];
                    const taskName = task?.name || taskId;

                    return (
                      <TreeNode
                        key={taskId}
                        label={`${taskId}: ${taskName}`}
                        level={2}
                        status={task?.status || 'pending'}
                        meta={{
                          duration: getTaskDuration(task),
                        }}
                        onClick={() => showView('l3', l1Name, l2Name, taskId)}
                        isLeaf
                      />
                    );
                  })}
                </TreeNode>
              );
            })}
          </TreeNode>
        );
      })}
    </div>
  );
}
