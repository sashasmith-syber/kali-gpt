import { 
  Activity, 
  Shield, 
  Globe, 
  FileText,
  Database,
  AlertTriangle,
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useThreatFeed } from '@/hooks/useThreatFeed';
import { useNetReaper } from '@/hooks/useNetReaper';
import { useIncidents } from '@/hooks/useIncidents';
import { useSpider } from '@/hooks/useSpider';
import { formatDistanceToNow } from 'date-fns';

export function Overview() {
  const { threats, isConnected, getThreatStats } = useThreatFeed();
  const { health: netReaperHealth, currentProfile, getProfileDisplayName } = useNetReaper();
  const { incidents } = useIncidents();
  const { health: spiderHealth } = useSpider();

  const stats = getThreatStats();
  const recentIncidents = incidents.slice(0, 5);
  const topThreatTypes = getTopThreatTypes();

  function getTopThreatTypes() {
    const typeCounts = new Map<string, number>();
    
    threats.forEach(threat => {
      typeCounts.set(threat.threat_type, (typeCounts.get(threat.threat_type) || 0) + 1);
    });

    return Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel border-acid/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Activity className="w-3 h-3" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={cn(
                "status-indicator",
                isConnected ? "status-live" : "status-danger"
              )} />
              <span className="text-sm font-medium">
                {isConnected ? 'All Systems Live' : 'Connection Lost'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-reaper/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Shield className="w-3 h-3" />
              Net-Reaper Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge 
              className={cn(
                "text-xs",
                currentProfile === 'passive' && "bg-muted text-muted-foreground",
                currentProfile === 'defensive' && "bg-cyber/20 text-cyber border-cyber",
                currentProfile === 'aggressive' && "bg-orange-500/20 text-orange-400 border-orange-500",
                currentProfile === 'scorched_earth' && "bg-reaper/20 text-reaper border-reaper"
              )}
            >
              {getProfileDisplayName(currentProfile)}
            </Badge>
          </CardContent>
        </Card>

        <Card className="glass-panel border-cyber/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Globe className="w-3 h-3" />
              Spider Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-cyber">
                {spiderHealth?.active_crawls || 0}
              </span>
              <span className="text-sm text-muted-foreground">
                active crawls
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <FileText className="w-3 h-3" />
              Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-yellow-400">
                {incidents.length}
              </span>
              <span className="text-sm text-muted-foreground">
                total incidents
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Threat Activity Chart */}
        <div className="lg:col-span-2">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="w-4 h-4 text-acid" />
                Threat Activity (Last 24 Hours)
                <Badge variant="outline" className="ml-auto">
                  Live
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Threat Timeline Visualization */}
              <div className="h-[200px] relative">
                {/* Grid background */}
                <div className="absolute inset-0 flex flex-col justify-between opacity-20">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-px bg-border" />
                  ))}
                </div>
                
                {/* Threat bars */}
                <div className="absolute inset-0 flex items-end justify-between gap-1 px-4">
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const hourThreats = threats.filter(t => {
                      const threatHour = new Date(t.timestamp).getHours();
                      return threatHour === hour;
                    });
                    
                    const maxHeight = 160;
                    const height = Math.min(
                      maxHeight,
                      (hourThreats.length / Math.max(stats.total / 24, 1)) * maxHeight * 0.8
                    );
                    
                    const hasHighRisk = hourThreats.some(t => t.risk_level >= 8);
                    const hasMediumRisk = hourThreats.some(t => t.risk_level >= 5 && t.risk_level < 8);
                    
                    return (
                      <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className={cn(
                            "w-full rounded-t transition-all",
                            hasHighRisk 
                              ? "bg-reaper" 
                              : hasMediumRisk 
                              ? "bg-orange-500" 
                              : "bg-yellow-500",
                            height > 0 ? "opacity-80" : "opacity-20"
                          )}
                          style={{ height: `${height || 4}px` }}
                          title={`${hour.toString().padStart(2, '0')}:00 - ${hourThreats.length} threat${hourThreats.length !== 1 ? 's' : ''}`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {hour % 3 === 0 ? `${hour.toString().padStart(2, '0')}h` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-reaper" />
                  <span className="text-muted-foreground">High Risk</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-orange-500" />
                  <span className="text-muted-foreground">Medium Risk</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  <span className="text-muted-foreground">Low Risk</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Threat Types */}
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-reaper" />
              Top Threat Types
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topThreatTypes.map(([type, count], index) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">
                    #{index + 1}
                  </span>
                  <span className="text-sm text-foreground">{type}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {count}
                </Badge>
              </div>
            ))}
            
            {topThreatTypes.length === 0 && (
              <div className="text-center py-4">
                <AlertTriangle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No threats detected yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4 text-cyber" />
            Recent Incidents
            <Badge variant="outline" className="ml-auto">
              {recentIncidents.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentIncidents.map((incident) => (
              <div 
                key={incident.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border hover:border-acid/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      className={cn(
                        "text-[10px] px-1.5 py-0.5",
                        incident.risk_level >= 8 
                          ? "bg-reaper text-white" 
                          : incident.risk_level >= 5
                          ? "bg-orange-500 text-white"
                          : "bg-yellow-500 text-black"
                      )}
                    >
                      {incident.risk_level}/10
                    </Badge>
                    <span className="text-sm font-medium text-foreground truncate">
                      {incident.threat_type}
                    </span>
                  </div>
                  <code className="text-xs text-acid font-mono block mb-1">
                    {incident.source_ips[0]}
                  </code>
                  <p className="text-xs text-muted-foreground">
                    {incident.action_taken}
                  </p>
                </div>
                
                <div className="flex flex-col items-end gap-1 ml-3">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px]",
                      incident.status === 'active' && "text-reaper border-reaper",
                      incident.status === 'investigating' && "text-yellow-400 border-yellow-400",
                      incident.status === 'resolved' && "text-acid border-acid"
                    )}
                  >
                    {incident.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(incident.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
            
            {recentIncidents.length === 0 && (
              <div className="text-center py-8">
                <Shield className="w-8 h-8 text-acid mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No recent incidents - systems secure
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Zap className="w-3 h-3 text-acid" />
              Net-Reaper
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground">
                {netReaperHealth?.threats_blocked || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                threats blocked
              </p>
              <p className="text-[10px] text-acid">
                {netReaperHealth?.uptime 
                  ? `${Math.floor(netReaperHealth.uptime / 3600)}h uptime`
                  : 'Loading...'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Database className="w-3 h-3 text-cyber" />
              Hybrid VCS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground">
                3,421
              </p>
              <p className="text-xs text-muted-foreground">
                commits
              </p>
              <p className="text-[10px] text-cyber">
                9f3ab4e (latest)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Clock className="w-3 h-3 text-yellow-400" />
              Last Threat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground">
                {threats.length > 0 ? `${threats[0].risk_level}/10` : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">
                {threats.length > 0 ? threats[0].threat_type : 'No threats'}
              </p>
              <p className="text-[10px] text-yellow-400">
                {threats.length > 0 
                  ? formatDistanceToNow(new Date(threats[0].timestamp), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <FileText className="w-3 h-3 text-muted-foreground" />
              Obsidian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground">
                1,247
              </p>
              <p className="text-xs text-muted-foreground">
                notes
              </p>
              <p className="text-[10px] text-muted-foreground">
                just now
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
