'use client';

import { useNavigation } from '@/context';
import type { ViewLevel } from '@/types';

export function Breadcrumbs() {
  const { currentView, selectedL1, selectedL2, selectedTaskId, showView } = useNavigation();

  const handleClick = (view: ViewLevel) => {
    switch (view) {
      case 'l0':
        showView('l0');
        break;
      case 'l1':
        showView('l1', selectedL1 ?? undefined);
        break;
      case 'l2':
        showView('l2', selectedL1 ?? undefined, selectedL2 ?? undefined);
        break;
      case 'l3':
        showView('l3', selectedL1 ?? undefined, selectedL2 ?? undefined, selectedTaskId ?? undefined);
        break;
    }
  };

  const isActive = (view: ViewLevel) => currentView === view;

  const items: { view: ViewLevel; label: string; show: boolean }[] = [
    { view: 'l0', label: 'Project', show: true },
    { view: 'l1', label: selectedL1 ?? 'Branch', show: currentView !== 'l0' },
    { view: 'l2', label: selectedL2 ?? 'Group', show: currentView === 'l2' || currentView === 'l3' },
    { view: 'l3', label: selectedTaskId ?? 'Task', show: currentView === 'l3' },
  ];

  const visibleItems = items.filter(item => item.show);

  return (
    <nav className="flex gap-2 mb-4 text-sm">
      {visibleItems.map((item, index) => (
        <span key={item.view} className="flex items-center">
          <button
            onClick={() => handleClick(item.view)}
            className={`
              px-2 py-1 rounded transition-colors
              ${isActive(item.view)
                ? 'text-accent font-semibold'
                : 'text-text-secondary hover:bg-bg-tertiary cursor-pointer'
              }
            `}
            disabled={isActive(item.view)}
          >
            {item.label}
          </button>
          {index < visibleItems.length - 1 && (
            <span className="ml-2 text-text-secondary">›</span>
          )}
        </span>
      ))}
    </nav>
  );
}
