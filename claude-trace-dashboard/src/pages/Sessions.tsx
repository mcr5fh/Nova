import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Sessions() {
  return (
    <div className="container py-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sessions</h2>
          <p className="text-muted-foreground">
            Browse and analyze task execution sessions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session List</CardTitle>
            <CardDescription>All task execution sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No sessions available</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
