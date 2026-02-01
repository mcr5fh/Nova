import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Analytics() {
  return (
    <div className="container py-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Performance metrics and insights
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Token Usage</CardTitle>
              <CardDescription>Token consumption over time</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Chart placeholder</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Analysis</CardTitle>
              <CardDescription>Estimated costs per model</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Chart placeholder</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tool Usage</CardTitle>
              <CardDescription>Most frequently used tools</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Chart placeholder</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
              <CardDescription>Task completion statistics</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Chart placeholder</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
