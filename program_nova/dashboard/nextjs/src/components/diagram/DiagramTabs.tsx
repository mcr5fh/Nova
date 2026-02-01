'use client';

/**
 * DiagramTabs - Tab component for switching between diagram types
 * Supports Flow, ERD, and System Architecture diagram types
 */

export type DiagramType = 'flow' | 'erd' | 'system';

interface DiagramTabsProps {
  activeTab: DiagramType;
  onTabChange: (tab: DiagramType) => void;
}

interface TabConfig {
  id: DiagramType;
  label: string;
  description: string;
}

const tabs: TabConfig[] = [
  { id: 'flow', label: 'Flow', description: 'Flowchart diagrams' },
  { id: 'erd', label: 'ERD', description: 'Entity Relationship Diagrams' },
  { id: 'system', label: 'System', description: 'System Architecture diagrams' },
];

export function DiagramTabs({ activeTab, onTabChange }: DiagramTabsProps) {
  return (
    <div className="flex gap-2 mb-4" role="tablist" aria-label="Diagram type selector">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-label={tab.description}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-accent text-white'
              : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
