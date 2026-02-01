import { useUIStore } from '@/stores/uiStore';

export function Header() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  return (
    <header
      className="h-16 border-b flex items-center px-6 gap-4"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Menu toggle button */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Toggle sidebar"
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Logo and title */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          C
        </div>
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text-0)' }}
        >
          Claude Trace Dashboard
        </h1>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connection status indicator */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: 'var(--color-status-green)' }}
          title="Connected"
        />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-2)' }}
        >
          Connected
        </span>
      </div>
    </header>
  );
}
