import { useCallback, useEffect, useState } from 'react';

const SIDEBAR_STORAGE_KEY = 'quizclass_sidebar_collapsed';

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useSidebarPreference() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(getInitialCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [sidebarCollapsed]);

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return { sidebarCollapsed, toggleSidebarCollapse };
}
