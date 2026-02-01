import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutDashboard, Network, ListTree, BarChart3 } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Task Tree",
    href: "/task-tree",
    icon: Network,
  },
  {
    title: "Sessions",
    href: "/sessions",
    icon: ListTree,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
];

export function Sidebar() {
  return (
    <aside className="glass-strong border-r w-64 flex-shrink-0">
      <ScrollArea className="h-full py-4">
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item, index) => (
            <NavLink
              key={item.href}
              to={item.href}
              style={{ animationDelay: `${index * 50}ms` }}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300",
                  "hover:glass hover:scale-105 hover:shadow-lg animate-fade-in",
                  isActive
                    ? "glass text-accent-foreground glow-primary"
                    : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
