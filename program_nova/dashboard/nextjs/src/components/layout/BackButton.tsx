'use client';

import { useNavigation } from '@/context';

export function BackButton() {
  const { currentView, goBack } = useNavigation();

  // Only show back button if not at L0 (project overview)
  if (currentView === 'l0') {
    return null;
  }

  return (
    <button
      onClick={goBack}
      className="
        bg-bg-secondary text-text-primary
        border border-border-color
        px-4 py-2 rounded-md
        cursor-pointer text-sm
        mb-4
        transition-all
        hover:bg-bg-tertiary hover:border-accent
      "
    >
      ← Back
    </button>
  );
}
