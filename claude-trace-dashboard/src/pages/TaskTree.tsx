import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskGraph } from "@/components/TaskGraph";
import { mockTasks, mockEdges } from "@/data/mockTasks";

export function TaskTree() {
  return (
    <div className="container py-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Task Tree</h2>
          <p className="text-muted-foreground">
            Visualize task hierarchy and dependencies with multiple views
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task Graph</CardTitle>
            <CardDescription>
              Interactive task visualizations - switch between tree, network, and timeline views
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[650px]">
            <TaskGraph tasks={mockTasks} edges={mockEdges} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
