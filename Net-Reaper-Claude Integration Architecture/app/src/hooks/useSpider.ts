import { useState, useEffect, useCallback } from 'react';
import type { SpiderCrawl, ThreatIntelFeed, SpiderHealth } from '@/types';
import { getBackendClient } from '@/backend-client';

export function useSpider() {
  const [crawls, setCrawls] = useState<SpiderCrawl[]>([]);
  const [intelFeeds, setIntelFeeds] = useState<ThreatIntelFeed[]>([]);
  const [health, setHealth] = useState<SpiderHealth | null>(null);
  const client = getBackendClient();

  const loadCrawls = useCallback(async () => {
    try {
      const response = await client.listCrawls();
      if (response.success && response.data) {
        setCrawls(response.data);
      }
    } catch (err) {
      console.error('[useSpider] Failed to load crawls:', err);
    }
  }, [client]);

  const loadIntelFeeds = useCallback(async () => {
    try {
      const response = await client.listIntelFeeds();
      if (response.success && response.data) {
        setIntelFeeds(response.data);
      }
    } catch (err) {
      console.error('[useSpider] Failed to load intel feeds:', err);
    }
  }, [client]);

  const loadHealth = useCallback(async () => {
    try {
      const response = await client.getSpiderHealth();
      if (response.success && response.data) {
        setHealth(response.data);
      }
    } catch (err) {
      console.error('[useSpider] Failed to load health:', err);
    }
  }, [client]);

  const startCrawl = useCallback(async (urls: string[], topic: string) => {
    try {
      const response = await client.startCrawl(urls, topic);
      if (response.success) {
        await loadCrawls();
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [client, loadCrawls]);

  const toggleIntelFeed = useCallback(async (feedId: string, enabled: boolean) => {
    try {
      const response = await client.toggleIntelFeed(feedId, enabled);
      if (response.success) {
        await loadIntelFeeds();
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [client, loadIntelFeeds]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-acid';
      case 'crawling': return 'text-cyber';
      case 'queued': return 'text-muted-foreground';
      case 'failed': return 'text-reaper';
      default: return 'text-muted-foreground';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([
        loadCrawls(),
        loadIntelFeeds(),
        loadHealth(),
      ]);
    };

    loadAll();
    // Refresh every 30 seconds
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadCrawls, loadIntelFeeds, loadHealth]);

  return {
    crawls,
    intelFeeds,
    health,
    startCrawl,
    toggleIntelFeed,
    getStatusColor,
    formatBytes,
    loadCrawls,
    loadIntelFeeds,
  };
}
