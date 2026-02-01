import { Network, GitBranch, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewType = "hierarchical" | "network" | "timeline";

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const views: Array<{
  type: ViewType;
  label: string;
  icon: typeof Network;
  description: string;
}> = [
  {
    type: "hierarchical",
    label: "Tree",
    icon: GitBranch,
    description: "Hierarchical tree with parent-child relationships",
  },
  {
    type: "network",
    label: "Network",
    icon: Network,
    description: "Force-directed graph with status clusters",
  },
  {
    type: "timeline",
    label: "Timeline",
    icon: Clock,
    description: "Timeline flow showing task progression",
  },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="flex gap-2">
      {views.map(view => {
        const Icon = view.icon;
        const isActive = currentView === view.type;

        return (
          <Button
            key={view.type}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange(view.type)}
            className="gap-2"
            title={view.description}
          >
            <Icon className="w-4 h-4" />
            {view.label}
          </Button>
        );
      })}
    </div>
  );
}
