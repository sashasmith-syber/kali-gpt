import { useState, useEffect, useCallback } from 'react';
import type { NetReaperHealth, ResponseProfile } from '@/types';
import { getBackendClient } from '@/backend-client';

export function useNetReaper() {
  const [health, setHealth] = useState<NetReaperHealth | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ResponseProfile>('defensive');
  const [isLoading, setIsLoading] = useState(true);
  const client = getBackendClient();

  const refreshHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await client.getNetReaperHealth();
      
      if (response.success && response.data) {
        setHealth(response.data);
        setCurrentProfile(response.data.profile);
      }
    } catch (err) {
      console.error('[useNetReaper] Failed to refresh health:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await client.getCurrentProfile();
      if (response.success && response.data) {
        setCurrentProfile(response.data.profile);
      }
    } catch (err) {
      console.error('[useNetReaper] Failed to refresh profile:', err);
    }
  }, [client]);

  const switchProfile = useCallback(async (profile: ResponseProfile) => {
    try {
      const response = await client.switchProfile(profile);
      if (response.success) {
        setCurrentProfile(profile);
        // Refresh full health after profile change
        await refreshHealth();
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [client, refreshHealth]);

  const blockIp = useCallback(async (ip: string, reason?: string) => {
    try {
      const response = await client.blockIp(ip, reason);
      return response;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }, [client]);

  const unblockIp = useCallback(async (ip: string) => {
    try {
      const response = await client.unblockIp(ip);
      return response;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }, [client]);

  const scanIp = useCallback(async (ip: string) => {
    try {
      const response = await client.scanIp(ip);
      return response;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }, [client]);

  useEffect(() => {
    refreshHealth();
    refreshProfile();

    // Refresh health every 30 seconds
    const interval = setInterval(refreshHealth, 30000);
    return () => clearInterval(interval);
  }, [refreshHealth, refreshProfile]);

  const getProfileColor = (profile: ResponseProfile): string => {
    switch (profile) {
      case 'passive': return 'text-muted-foreground';
      case 'defensive': return 'text-cyber';
      case 'aggressive': return 'text-reaper';
      case 'scorched_earth': return 'text-reaper animate-pulse';
      default: return 'text-muted-foreground';
    }
  };

  const getProfileDisplayName = (profile: ResponseProfile): string => {
    switch (profile) {
      case 'passive': return 'Passive 👁';
      case 'defensive': return 'Defensive 🛡';
      case 'aggressive': return 'Aggressive ⚔';
      case 'scorched_earth': return 'Scorched Earth ☠';
      default: return profile;
    }
  };

  return {
    health,
    currentProfile,
    isLoading,
    switchProfile,
    blockIp,
    unblockIp,
    scanIp,
    refreshHealth,
    getProfileColor,
    getProfileDisplayName,
  };
}
