// Net-Reaper Types
export interface ThreatEvent {
  source: 'net-reaper';
  event: 'threat_detected' | 'heartbeat';
  timestamp: string;
  risk_level: number;
  threat_type: string;
  source_ips: string[];
  action_taken: string;
  success: boolean;
  profile: string;
  vcs_commit?: string;
}

export interface ThreatAnalysis {
  risk_level: number;
  threat_type: string;
  source_ips: string[];
  recommended_action: string;
  command?: string;
  commands: string[];
  raw_response?: string;
}

export interface ThreatLogEntry {
  analysis: ThreatAnalysis;
  action_taken: string;
  success: boolean;
  timestamp: string;
}

export type ResponseProfile = 'passive' | 'defensive' | 'aggressive' | 'scorched_earth';

export interface NetReaperHealth {
  status: 'healthy' | 'warning' | 'error';
  version: string;
  profile: ResponseProfile;
  uptime: number;
  threats_blocked: number;
  last_update: string;
}

// K2 Security Types
export interface K2Health {
  curve_handshake: boolean;
  handshake_latency_ms: number;
  vcs_connected: boolean;
  obsidian_connected: boolean;
  last_event_received: string;
  uptime: number;
}

export interface SecurityIncident {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_level: number;
  threat_type: string;
  timestamp: string;
  status: 'active' | 'resolved' | 'investigating';
  source_ips: string[];
  action_taken: string;
  success: boolean;
  profile: string;
  vcs_commit?: string;
  filepath?: string;
}

// Obsidian Types
export interface ObsidianNote {
  filepath: string;
  filename: string;
  content: string;
  frontmatter: Record<string, any>;
  modified: string;
}

export interface ObsidianHealth {
  vault_path: string;
  connected: boolean;
  note_count: number;
  last_sync: string;
}

// Hybrid VCS Types
export interface VCSCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  files: string[];
}

export interface VCSHealth {
  repo_path: string;
  connected: boolean;
  commit_count: number;
  last_commit: VCSCommit;
  branch: string;
}

// Spider Types
export interface SpiderCrawl {
  id: string;
  url: string;
  status: 'queued' | 'crawling' | 'completed' | 'failed';
  progress: number;
  pages_crawled: number;
  bytes_downloaded: number;
  start_time?: string;
  end_time?: string;
  vcs_commit?: string;
}

export interface ThreatIntelFeed {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_update?: string;
  entries_count: number;
}

export interface SpiderHealth {
  active_crawls: number;
  completed_today: number;
  feeds_enabled: number;
  last_crawl: string;
}

// Audit Types
export interface AuditLogEntry {
  timestamp: string;
  user: string;
  action: string;
  target?: string;
  ip?: string;
  details?: Record<string, any>;
  severity: 'info' | 'warning' | 'error';
}

// Settings Types
export interface AppSettings {
  netreaper: {
    base_url: string;
    curve_keys_path?: string;
  };
  k2: {
    zmq_endpoint: string;
    curve_public?: string;
    curve_secret?: string;
  };
  obsidian: {
    vault_path: string;
  };
  vcs: {
    repo_path: string;
  };
  kimi: {
    api_key?: string;
    base_url: string;
    model: string;
  };
  spider: {
    base_url: string;
  };
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'threat' | 'heartbeat' | 'audit' | 'status';
  data: any;
  timestamp: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Geo Types for Threat Radar
export interface GeoLocation {
  ip: string;
  country: string;
  country_code: string;
  city?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface ThreatGeoPoint {
  ip: string;
  location: GeoLocation;
  risk_level: number;
  threat_type: string;
  timestamp: string;
  count: number;
}
