import { useState, useEffect, useCallback } from 'react';
import type { ThreatEvent } from '@/types';
import { getBackendClient } from '@/backend-client';

export function useThreatFeed() {
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const client = getBackendClient();
  const maxThreats = 100;

  const handleThreatMessage = useCallback((data: any) => {
    try {
      if (data.type === 'threat' && data.event) {
        const threat: ThreatEvent = data.event;
        
        setThreats(prev => {
          const updated = [threat, ...prev].slice(0, maxThreats);
          return updated;
        });
        
        setLastUpdate(new Date());
      } else if (data.type === 'heartbeat') {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('[useThreatFeed] Failed to process threat message:', error);
    }
  }, []);

  useEffect(() => {
    // Connect to WebSocket threat feed
    client.connectWebSocket(handleThreatMessage);
    setIsConnected(true);

    // Simulate threats distributed across the last 24 hours for demo
    const now = new Date();
    const mockThreats: ThreatEvent[] = [
      // Recent threats (last hour)
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        risk_level: 8,
        threat_type: 'SSH Brute Force',
        source_ips: ['203.0.113.5'],
        action_taken: 'blocked:203.0.113.5',
        success: true,
        profile: 'defensive',
      },
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        risk_level: 6,
        threat_type: 'Port Scan',
        source_ips: ['198.51.100.23'],
        action_taken: 'rate_limited:198.51.100.23',
        success: true,
        profile: 'defensive',
      },
      // Threats from earlier today (distributed across hours)
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        risk_level: 9,
        threat_type: 'SQL Injection',
        source_ips: ['192.0.2.45'],
        action_taken: 'blocked:192.0.2.45',
        success: true,
        profile: 'aggressive',
      },
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        risk_level: 5,
        threat_type: 'Directory Traversal',
        source_ips: ['198.51.100.67'],
        action_taken: 'logged:198.51.100.67',
        success: true,
        profile: 'defensive',
      },
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        risk_level: 7,
        threat_type: 'XSS Attempt',
        source_ips: ['203.0.113.89'],
        action_taken: 'blocked:203.0.113.89',
        success: true,
        profile: 'defensive',
      },
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        risk_level: 4,
        threat_type: 'Suspicious User-Agent',
        source_ips: ['192.0.2.12'],
        action_taken: 'logged:192.0.2.12',
        success: true,
        profile: 'passive',
      },
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
        risk_level: 6,
        threat_type: 'Port Scan',
        source_ips: ['198.51.100.99'],
        action_taken: 'rate_limited:198.51.100.99',
        success: true,
        profile: 'defensive',
      },
      {
        source: 'net-reaper',
        event: 'threat_detected',
        timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(),
        risk_level: 8,
        threat_type: 'Brute Force Login',
        source_ips: ['203.0.113.47'],
        action_taken: 'blocked:203.0.113.47',
        success: true,
        profile: 'aggressive',
      },
    ];
    
    setThreats(mockThreats);

    return () => {
      client.disconnectWebSocket();
    };
  }, [client, handleThreatMessage]);

  const getThreatStats = useCallback(() => {
    const stats = {
      total: threats.length,
      highRisk: threats.filter(t => t.risk_level >= 7).length,
      mediumRisk: threats.filter(t => t.risk_level >= 4 && t.risk_level < 7).length,
      lowRisk: threats.filter(t => t.risk_level < 4).length,
      blocked: threats.filter(t => t.action_taken?.includes('blocked')).length,
      lastHour: threats.filter(t => 
        new Date(t.timestamp) > new Date(Date.now() - 3600000)
      ).length,
    };
    return stats;
  }, [threats]);

  const getTopAttackers = useCallback(() => {
    const ipCounts = new Map<string, number>();
    
    threats.forEach(threat => {
      threat.source_ips.forEach(ip => {
        ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
      });
    });

    return Array.from(ipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
  }, [threats]);

  return {
    threats,
    isConnected,
    lastUpdate,
    getThreatStats,
    getTopAttackers,
  };
}
