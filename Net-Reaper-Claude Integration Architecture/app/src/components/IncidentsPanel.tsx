import { useState } from 'react';
import { 
  FileText, 
  Eye,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useIncidents } from '@/hooks/useIncidents';
import type { SecurityIncident } from '@/types';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow, format } from 'date-fns';

export function IncidentsPanel() {
  const { 
    incidents, 
    selectedIncident, 
    setSelectedIncident,
    getSeverityColor,
    getRiskColor,
    getStatusColor,
  } = useIncidents();

  const [filter, setFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = !filter || 
      incident.threat_type.toLowerCase().includes(filter.toLowerCase()) ||
      incident.source_ips.some(ip => ip.includes(filter));
    
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getIncidentPreview = (incident: SecurityIncident) => {
    return `
## ${incident.threat_type}

**Severity:** ${incident.severity} (${incident.risk_level}/10)  
**Status:** ${incident.status}  
**Detected:** ${format(new Date(incident.timestamp), 'PPp')}  
**Source IPs:** ${incident.source_ips.join(', ')}  
**Action:** ${incident.action_taken}

---

### Analysis
<!-- Claude will analyze this incident and add insights here -->

### Related Incidents
<!-- K2 will auto-link similar past incidents -->

### Response Checklist
- [ ] Review blocked IPs
- [ ] Check for lateral movement
- [ ] Verify no data exfiltration
- [ ] Update firewall rules
- [ ] Document lessons learned
    `;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Incident List */}
      <div className="lg:col-span-1">
        <Card className="glass-panel h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-acid" />
              Security Incidents
              <Badge variant="outline" className="ml-auto">
                {filteredIncidents.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search incidents..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9 bg-secondary border-border text-sm"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground"
                >
                  <option value="all">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Incident List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredIncidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors",
                    selectedIncident?.id === incident.id
                      ? "bg-sidebar-primary border-sidebar-primary"
                      : "bg-secondary/50 border-border hover:bg-secondary"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge 
                      className={cn(
                        "text-[10px] px-1.5 py-0.5",
                        getSeverityColor(incident.severity)
                      )}
                    >
                      {incident.severity}
                    </Badge>
                    <span className={cn("text-xs", getStatusColor(incident.status))}>
                      {incident.status}
                    </span>
                  </div>
                  
                  <p className="text-xs font-medium text-foreground mb-1 line-clamp-1">
                    {incident.threat_type}
                  </p>
                  
                  <code className="text-[10px] text-acid font-mono block mb-1">
                    {incident.source_ips[0]}
                  </code>
                  
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[10px] font-bold", getRiskColor(incident.risk_level))}>
                      Risk: {incident.risk_level}/10
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(incident.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
              
              {filteredIncidents.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    No incidents match your filters
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incident Details */}
      <div className="lg:col-span-2">
        <Card className="glass-panel h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Eye className="w-4 h-4 text-cyber" />
              Incident Details
              {selectedIncident && (
                <Badge 
                  className={cn(
                    "ml-auto",
                    getSeverityColor(selectedIncident.severity)
                  )}
                >
                  {selectedIncident.id}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="h-[600px] overflow-y-auto">
            {selectedIncident ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {selectedIncident.threat_type}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedIncident.timestamp), 'PPpp')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(selectedIncident.severity)}>
                      {selectedIncident.severity}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(selectedIncident.status)}>
                      {selectedIncident.status}
                    </Badge>
                  </div>
                </div>

                {/* Key Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Risk Level
                    </p>
                    <p className={cn("text-2xl font-bold", getRiskColor(selectedIncident.risk_level))}>
                      {selectedIncident.risk_level}/10
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Source IPs
                    </p>
                    <div className="space-y-1">
                      {selectedIncident.source_ips.map((ip) => (
                        <code key={ip} className="text-xs text-acid font-mono block">
                          {ip}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Taken */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Action Taken
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedIncident.success ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-reaper">✗</span>
                    )}
                    <span className="text-sm text-foreground">
                      {selectedIncident.action_taken}
                    </span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {selectedIncident.profile}
                    </Badge>
                  </div>
                </div>

                {/* Incident Content */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown 
                    components={{
                      h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-3 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="text-sm text-muted-foreground mb-2">{children}</p>,
                      code: ({ children }) => <code className="text-xs text-acid bg-secondary px-1 py-0.5 rounded font-mono">{children}</code>,
                      pre: ({ children }) => <pre className="bg-secondary p-3 rounded-lg overflow-x-auto text-xs">{children}</pre>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">{children}</ul>,
                      li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                    }}
                  >
                    {getIncidentPreview(selectedIncident)}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Select an incident to view details
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
