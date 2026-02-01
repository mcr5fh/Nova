'use client';

/**
 * Example usage of DiagramTabs component
 * This demonstrates how to integrate DiagramTabs with a parent component
 */

import { useState } from 'react';
import { DiagramTabs, DiagramType } from './DiagramTabs';

export function DiagramTabsExample() {
  const [activeTab, setActiveTab] = useState<DiagramType>('flow');

  const handleTabChange = (tab: DiagramType) => {
    setActiveTab(tab);
    console.log('Active diagram type changed to:', tab);
    // Here you would typically:
    // - Update state in parent component
    // - Fetch different diagram data
    // - Render different diagram type
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-text-primary mb-4">
        Diagram Type Selector
      </h2>

      <DiagramTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Render different content based on active tab */}
      <div className="bg-bg-secondary border border-border-color rounded-lg p-4">
        <p className="text-text-primary">
          Active diagram type: <span className="font-semibold text-accent">{activeTab}</span>
        </p>

        {activeTab === 'flow' && (
          <p className="text-text-secondary mt-2">
            Display flowchart diagrams here
          </p>
        )}

        {activeTab === 'erd' && (
          <p className="text-text-secondary mt-2">
            Display entity relationship diagrams here
          </p>
        )}

        {activeTab === 'system' && (
          <p className="text-text-secondary mt-2">
            Display system architecture diagrams here
          </p>
        )}
      </div>
    </div>
  );
}
