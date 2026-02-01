'use client';

import { useNavigation } from '@/context';
import { L0ProjectView } from './L0ProjectView';
import { L1BranchView } from './L1BranchView';
import { L2GroupView } from './L2GroupView';
import { L3TaskView } from './L3TaskView';
import type { StatusResponse } from '@/types';

interface ViewRouterProps {
  status: StatusResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-text-secondary">Loading...</div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="bg-red-900/20 border border-status-failed rounded-lg p-4">
      <h3 className="text-lg font-semibold text-status-failed mb-2">Error Loading Data</h3>
      <p className="text-text-primary">{error.message}</p>
    </div>
  );
}

function NoDataState() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-text-secondary">No data available. Select an epic in Bead mode or start a cascade run.</div>
    </div>
  );
}

export function ViewRouter({ status, isLoading, error }: ViewRouterProps) {
  const { currentView, selectedL1, selectedL2, selectedTaskId } = useNavigation();

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!status) {
    return <NoDataState />;
  }

  switch (currentView) {
    case 'l0':
      return <L0ProjectView status={status} />;

    case 'l1':
      if (!selectedL1) {
        return <div className="text-text-secondary">No branch selected</div>;
      }
      return <L1BranchView status={status} branchName={selectedL1} />;

    case 'l2':
      if (!selectedL1 || !selectedL2) {
        return <div className="text-text-secondary">No group selected</div>;
      }
      return <L2GroupView status={status} branchName={selectedL1} groupName={selectedL2} />;

    case 'l3':
      if (!selectedTaskId) {
        return <div className="text-text-secondary">No task selected</div>;
      }
      return <L3TaskView status={status} taskId={selectedTaskId} />;

    default:
      return <L0ProjectView status={status} />;
  }
}
