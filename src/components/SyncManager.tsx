import React, { useEffect } from 'react';
import { syncWithServer } from '../lib/store';

export const SyncManager: React.FC = () => {
  useEffect(() => {
    // Initial sync
    syncWithServer();

    // Poll for changes every 1 second to keep everyone in sync
    const interval = setInterval(syncWithServer, 1000);

    // Also sync when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithServer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null; // Invisible component
};
