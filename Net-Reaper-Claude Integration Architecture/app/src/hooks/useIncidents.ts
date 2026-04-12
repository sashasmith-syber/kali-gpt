import { useState, useEffect, useCallback } from 'react';
import type { SecurityIncident } from '@/types';
import { getBackendClient } from '@/backend-client';

export function useIncidents() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const client = getBackendClient();

  const loadIncidents = useCallback(async () => {
    try {
      const response = await client.listIncidents();
      if (response.success && response.data) {
        setIncidents(response.data);
      }
    } catch (err) {
      console.error('[useIncidents] Failed to load incidents:', err);
    }
  }, [client]);

  const loadIncident = useCallback(async (id: string) => {
    try {
      const response = await client.getIncident(id);
      if (response.success && response.data) {
        setSelectedIncident(response.data);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useIncidents] Failed to load incident:', err);
      return null;
    }
  }, [client]);

  const createIncidentFromThreat = useCallback(async () => {
    // This would create a new incident note in Obsidian
    // For now, we'll just refresh the list
    await loadIncidents();
  }, [loadIncidents]);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'CRITICAL': return 'bg-reaper text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskColor = (riskLevel: number): string => {
    if (riskLevel >= 9) return 'text-reaper';
    if (riskLevel >= 7) return 'text-orange-400';
    if (riskLevel >= 4) return 'text-yellow-400';
    return 'text-muted-foreground';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-reaper';
      case 'investigating': return 'text-yellow-400';
      case 'resolved': return 'text-acid';
      default: return 'text-muted-foreground';
    }
  };

  useEffect(() => {
    loadIncidents();
    // Refresh every 60 seconds
    const interval = setInterval(loadIncidents, 60000);
    return () => clearInterval(interval);
  }, [loadIncidents]);

  return {
    incidents,
    selectedIncident,
    loadIncidents,
    loadIncident,
    setSelectedIncident,
    createIncidentFromThreat,
    getSeverityColor,
    getRiskColor,
    getStatusColor,
  };
}
