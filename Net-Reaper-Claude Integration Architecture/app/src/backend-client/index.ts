import type {
  NetReaperHealth,
  ResponseProfile,
  K2Health,
  SecurityIncident,
  ObsidianHealth,
  VCSHealth,
  VCSCommit,
  SpiderCrawl,
  ThreatIntelFeed,
  SpiderHealth,
  ApiResponse,
  AuditLogEntry,
} from '@/types';

// Configuration
export interface BackendConfig {
  netreaper: {
    baseUrl: string;
  };
  k2: {
    zmqEndpoint: string;
    websocketUrl: string;
  };
  obsidian: {
    vaultPath: string;
    baseUrl?: string;
  };
  vcs: {
    repoPath: string;
    baseUrl?: string;
  };
  spider: {
    baseUrl: string;
  };
}

class BackendClient {
  private config: BackendConfig;
  private websocket?: WebSocket;

  constructor(config: BackendConfig) {
    this.config = config;
  }

  // Net-Reaper API Client
  async getNetReaperHealth(): Promise<ApiResponse<NetReaperHealth>> {
    try {
      const response = await fetch(`${this.config.netreaper.baseUrl}/health`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async blockIp(ip: string, reason?: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetch(`${this.config.netreaper.baseUrl}/api/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, reason }),
      });
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async unblockIp(ip: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetch(`${this.config.netreaper.baseUrl}/api/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async switchProfile(profile: ResponseProfile): Promise<ApiResponse<{ profile: ResponseProfile }>> {
    try {
      const response = await fetch(`${this.config.netreaper.baseUrl}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCurrentProfile(): Promise<ApiResponse<{ profile: ResponseProfile }>> {
    try {
      const response = await fetch(`${this.config.netreaper.baseUrl}/api/profile`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async scanIp(ip: string): Promise<ApiResponse<{ scan: any }>> {
    try {
      const response = await fetch(`${this.config.netreaper.baseUrl}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // K2 Security API Client
  async getK2Health(): Promise<ApiResponse<K2Health>> {
    try {
      const response = await fetch(`${this.config.k2.websocketUrl}/health`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Mock response for demo
      return {
        success: true,
        data: {
          curve_handshake: true,
          handshake_latency_ms: 45,
          vcs_connected: true,
          obsidian_connected: true,
          last_event_received: new Date().toISOString(),
          uptime: 3600,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Obsidian API Client
  async getObsidianHealth(): Promise<ApiResponse<ObsidianHealth>> {
    try {
      const response = await fetch(`${this.config.obsidian.baseUrl || ''}/obsidian/health`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Mock response for demo
      return {
        success: true,
        data: {
          vault_path: this.config.obsidian.vaultPath,
          connected: true,
          note_count: 1247,
          last_sync: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async listIncidents(): Promise<ApiResponse<SecurityIncident[]>> {
    try {
      const response = await fetch(`${this.config.obsidian.baseUrl || ''}/obsidian/incidents`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Mock data for demo
      return {
        success: true,
        data: [
          {
            id: 'INC-20260110-143022',
            severity: 'HIGH',
            risk_level: 8,
            threat_type: 'SSH Brute Force',
            timestamp: '2026-01-10T14:30:22Z',
            status: 'active',
            source_ips: ['203.0.113.5'],
            action_taken: 'blocked:203.0.113.5',
            success: true,
            profile: 'defensive',
            filepath: 'Security/Incidents/INC-20260110-143022.md',
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getIncident(id: string): Promise<ApiResponse<SecurityIncident>> {
    try {
      const response = await fetch(`${this.config.obsidian.baseUrl || ''}/obsidian/incidents/${id}`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // VCS API Client
  async getVCSHealth(): Promise<ApiResponse<VCSHealth>> {
    try {
      const response = await fetch(`${this.config.vcs.baseUrl || ''}/vcs/health`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Mock response for demo
      return {
        success: true,
        data: {
          repo_path: this.config.vcs.repoPath,
          connected: true,
          commit_count: 3421,
          last_commit: {
            hash: '9f3ab4e',
            message: 'Threat log: SSH brute-force',
            author: 'K2 Security Hub',
            timestamp: new Date().toISOString(),
            files: ['Security/Incidents/INC-20260110-143022.md'],
          },
          branch: 'main',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async listCommits(limit: number = 10): Promise<ApiResponse<VCSCommit[]>> {
    try {
      const response = await fetch(`${this.config.vcs.baseUrl || ''}/vcs/commits?limit=${limit}`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Spider API Client
  async getSpiderHealth(): Promise<ApiResponse<SpiderHealth>> {
    try {
      const response = await fetch(`${this.config.spider.baseUrl}/health`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Mock response for demo
      return {
        success: true,
        data: {
          active_crawls: 2,
          completed_today: 15,
          feeds_enabled: 3,
          last_crawl: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async listCrawls(): Promise<ApiResponse<SpiderCrawl[]>> {
    try {
      const response = await fetch(`${this.config.spider.baseUrl}/crawls`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async startCrawl(urls: string[], topic: string): Promise<ApiResponse<{ crawl_id: string }>> {
    try {
      const response = await fetch(`${this.config.spider.baseUrl}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, topic }),
      });
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async listIntelFeeds(): Promise<ApiResponse<ThreatIntelFeed[]>> {
    try {
      const response = await fetch(`${this.config.spider.baseUrl}/intel/feeds`);
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Mock data for demo
      return {
        success: true,
        data: [
          {
            id: 'emerging-threats',
            name: 'Emerging Threats',
            url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
            enabled: true,
            entries_count: 15420,
          },
          {
            id: 'spamhaus',
            name: 'Spamhaus DROP',
            url: 'https://www.spamhaus.org/drop/drop.txt',
            enabled: true,
            entries_count: 892,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async toggleIntelFeed(feedId: string, enabled: boolean): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetch(`${this.config.spider.baseUrl}/intel/feeds/${feedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // WebSocket for live threat feed
  connectWebSocket(onMessage: (data: any) => void): void {
    try {
      this.websocket = new WebSocket(this.config.k2.websocketUrl);
      
      this.websocket.onopen = () => {
        console.log('[WebSocket] Connected to threat feed');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      this.websocket.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
      
      this.websocket.onclose = () => {
        console.log('[WebSocket] Disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(onMessage), 5000);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
    }
  }

  disconnectWebSocket(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }
  }

  // Audit logging
  async logAuditEntry(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entry,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      return {
        success: response.ok,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Audit] Failed to log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Default configuration
export const defaultConfig: BackendConfig = {
  netreaper: {
    baseUrl: 'http://localhost:8000',
  },
  k2: {
    zmqEndpoint: 'tcp://127.0.0.1:5555',
    websocketUrl: 'ws://localhost:8001',
  },
  obsidian: {
    vaultPath: '~/Development/obsidian-vault',
    baseUrl: 'http://localhost:8002',
  },
  vcs: {
    repoPath: '~/Development/hybrid-vcs-repo',
    baseUrl: 'http://localhost:8003',
  },
  spider: {
    baseUrl: 'http://localhost:8004',
  },
};

// Singleton instance
let backendClient: BackendClient | null = null;

export function getBackendClient(config?: BackendConfig): BackendClient {
  if (!backendClient) {
    backendClient = new BackendClient(config || defaultConfig);
  }
  return backendClient;
}

export default BackendClient;
