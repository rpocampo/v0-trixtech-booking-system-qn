interface UpdateInfo {
  version: string;
  changelog: string[];
  critical: boolean;
  downloadUrl?: string;
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateInfo?: UpdateInfo;
}

class AutoUpdateService {
  private static instance: AutoUpdateService;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private listeners: ((result: UpdateCheckResult) => void)[] = [];

  private constructor() {}

  static getInstance(): AutoUpdateService {
    if (!AutoUpdateService.instance) {
      AutoUpdateService.instance = new AutoUpdateService();
    }
    return AutoUpdateService.instance;
  }

  // Check for updates from a remote source
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      // In a real implementation, this would check a remote API
      // For now, we'll simulate checking package.json version
      const response = await fetch('/api/version');
      if (!response.ok) {
        // Fallback to local version check
        return this.getLocalVersionInfo();
      }

      const remoteVersion = await response.json();
      const localVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

      const hasUpdate = this.compareVersions(remoteVersion.version, localVersion);

      return {
        hasUpdate,
        currentVersion: localVersion,
        latestVersion: remoteVersion.version,
        updateInfo: hasUpdate ? remoteVersion : undefined
      };
    } catch (error) {
      console.error('Update check failed:', error);
      return this.getLocalVersionInfo();
    }
  }

  private getLocalVersionInfo(): UpdateCheckResult {
    const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion
    };
  }

  private compareVersions(remote: string, local: string): boolean {
    const remoteParts = remote.split('.').map(Number);
    const localParts = local.split('.').map(Number);

    for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
      const remotePart = remoteParts[i] || 0;
      const localPart = localParts[i] || 0;

      if (remotePart > localPart) return true;
      if (remotePart < localPart) return false;
    }

    return false;
  }

  // Start automatic update checking
  startAutoCheck(intervalMinutes: number = 60): void {
    this.stopAutoCheck(); // Clear any existing interval

    this.updateCheckInterval = setInterval(async () => {
      const result = await this.checkForUpdates();
      this.notifyListeners(result);
    }, intervalMinutes * 60 * 1000);

    // Initial check
    this.checkForUpdates().then(result => this.notifyListeners(result));
  }

  // Stop automatic update checking
  stopAutoCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  // Subscribe to update notifications
  onUpdateAvailable(callback: (result: UpdateCheckResult) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(result: UpdateCheckResult): void {
    this.listeners.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('Update listener error:', error);
      }
    });
  }

  // Force refresh the application
  forceRefresh(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  // Check if service worker updates are available
  async checkServiceWorkerUpdates(): Promise<boolean> {
    if ('serviceWorker' in navigator && 'controller' in navigator.serviceWorker) {
      return new Promise((resolve) => {
        navigator.serviceWorker.controller?.postMessage({ type: 'CHECK_FOR_UPDATES' });

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
            resolve(true);
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
    }
    return false;
  }
}

// Data synchronization service
export class DataSyncService {
  private static instance: DataSyncService;
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;

  private constructor() {}

  static getInstance(): DataSyncService {
    if (!DataSyncService.instance) {
      DataSyncService.instance = new DataSyncService();
    }
    return DataSyncService.instance;
  }

  // Sync data with server
  async syncData(endpoint: string, localData: any): Promise<any> {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return localData;
    }

    this.syncInProgress = true;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: localData,
          lastSync: this.lastSyncTime?.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();
      this.lastSyncTime = new Date();

      return result.data;
    } catch (error) {
      console.error('Data sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Auto-sync with interval
  startAutoSync(endpoint: string, localData: any, intervalMinutes: number = 5): () => void {
    const sync = () => {
      this.syncData(endpoint, localData).catch(error => {
        console.error('Auto-sync failed:', error);
      });
    };

    // Initial sync
    sync();

    // Set up interval
    const intervalId = setInterval(sync, intervalMinutes * 60 * 1000);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

export default AutoUpdateService;