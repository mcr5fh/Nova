import { useState } from "react";
import type { TaskNode, TaskEdge } from "@/types/task";
import { HierarchicalTree } from "./HierarchicalTree";
import { NetworkView } from "./NetworkView";
import { TimelineFlow } from "./TimelineFlow";
import { ViewSwitcher, type ViewType } from "./ViewSwitcher";

interface TaskGraphProps {
  tasks: TaskNode[];
  edges: TaskEdge[];
}

export function TaskGraph({ tasks, edges }: TaskGraphProps) {
  const [currentView, setCurrentView] = useState<ViewType>("hierarchical");

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
        <div className="text-sm text-muted-foreground">
          {tasks.length} tasks · {edges.length} dependencies
        </div>
      </div>

      <div className="flex-1">
        {currentView === "hierarchical" && (
          <HierarchicalTree tasks={tasks} edges={edges} />
        )}
        {currentView === "network" && <NetworkView tasks={tasks} edges={edges} />}
        {currentView === "timeline" && <TimelineFlow tasks={tasks} edges={edges} />}
      </div>
    </div>
  );
}
