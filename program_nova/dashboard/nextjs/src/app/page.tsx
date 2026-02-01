'use client';

import { useStatus } from '@/hooks';
import { Header, Breadcrumbs, BackButton, StatusIndicator } from '@/components/layout';
import { ViewRouter } from '@/components/views';

export default function Home() {
  const { data: status, isLoading, error } = useStatus();

  const allTasksCompleted = status?.all_tasks_completed ?? false;

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
    </main>
  );
}
