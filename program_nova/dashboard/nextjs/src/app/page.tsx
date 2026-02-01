'use client';

import { useStatus } from '@/hooks';
import { Header, Breadcrumbs, BackButton, StatusIndicator } from '@/components/layout';
import { ViewRouter } from '@/components/views';
import PlanningMode from '@/components/planning/PlanningMode';
import { useNavigation } from '@/context';

export default function Home() {
  const { data: status, isLoading, error } = useStatus();
  const { mode, epicId } = useNavigation();

  const allTasksCompleted = status?.all_tasks_completed ?? false;

  // Show planning mode when:
  // - Planning mode is explicitly selected
  // - In cascade mode: no active cascade run (404 or no status)
  const is404 = error && (error.message.includes('404') || error.message.includes('not found'));
  const hasNoData = !status || is404;
  const showPlanningMode = mode === 'planning' || (mode === 'cascade' && hasNoData);

  return (
    <main className="max-w-[1600px] mx-auto p-6">
      {/* Connection status indicator */}
      <StatusIndicator
        isConnected={!isLoading && !error}
        isCompleted={allTasksCompleted}
        isError={!!error}
      />

      {/* Header with project info and mode selector */}
      <Header status={status} />

      {showPlanningMode && !isLoading ? (
        /* Planning Mode - full height chat interface */
        <div className="h-[calc(100vh-12rem)] -mx-6 -mb-6">
          <PlanningMode />
        </div>
      ) : (
        <>
          {/* Navigation breadcrumbs */}
          <Breadcrumbs />

          {/* Back button for nested views */}
          <BackButton />

          {/* Main content - view router switches between L0/L1/L2/L3 */}
          <ViewRouter
            status={status}
            isLoading={isLoading}
            error={error as Error | null}
          />
        </>
      )}
    </main>
  );
}
