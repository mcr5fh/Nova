import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="glass-strong border-b sticky top-0 z-50 animate-slide-down">
      <div className="container flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Claude Trace Dashboard
          </h1>
          <Badge variant="outline" className="glass">
            Beta
          </Badge>
        </div>
      </div>
    </header>
  );
}
