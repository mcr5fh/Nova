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
            Visualize task hierarchy and dependencies
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task Graph</CardTitle>
            <CardDescription>Interactive task tree visualization with React Flow</CardDescription>
          </CardHeader>
          <CardContent className="h-[600px]">
            <TaskGraph tasks={mockTasks} edges={mockEdges} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
