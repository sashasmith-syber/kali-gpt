import { 
  Activity, 
  Globe,
  TrendingUp,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useThreatFeed } from '@/hooks/useThreatFeed';
import { formatDistanceToNow } from 'date-fns';

export function ThreatRadar() {
  const { threats, isConnected, lastUpdate, getThreatStats, getTopAttackers } = useThreatFeed();
  const stats = getThreatStats();
  const topAttackers = getTopAttackers();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Threat Stats */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="glass-panel border-acid/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="w-4 h-4 text-acid" />
              Threat Activity
              {isConnected && (
                <span className="status-indicator status-live ml-auto" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-secondary/50">
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Threats</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-reaper/10">
                <p className="text-2xl font-bold text-reaper">{stats.highRisk}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                <p className="text-2xl font-bold text-yellow-400">{stats.mediumRisk}</p>
                <p className="text-xs text-muted-foreground">Medium Risk</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-muted-foreground">{stats.blocked}</p>
                <p className="text-xs text-muted-foreground">Blocked</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last update: {formatDistanceToNow(lastUpdate, { addSuffix: true })}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-reaper" />
                +{stats.lastHour} this hour
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Top Attackers */}
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Globe className="w-4 h-4 text-reaper" />
              Top Attackers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topAttackers.slice(0, 5).map((attacker, index) => (
              <div 
                key={attacker.ip}
                className="flex items-center justify-between p-2 rounded bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">
                    #{index + 1}
                  </span>
                  <code className="text-xs text-acid font-mono">
                    {attacker.ip}
                  </code>
                </div>
                <Badge variant="outline" className="text-xs">
                  {attacker.count}x
                </Badge>
              </div>
            ))}
            
            {topAttackers.length === 0 && (
              <div className="text-center py-4">
                <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No attackers detected yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Threat Visualization */}
      <div className="lg:col-span-2">
        <Card className="glass-panel h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Globe className="w-4 h-4 text-cyber" />
              Threat Radar
              <Badge variant="outline" className="ml-auto text-acid border-acid">
                LIVE
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] relative">
            {/* Radar Grid Background */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              {/* Grid lines */}
              <svg className="absolute inset-0 w-full h-full opacity-20">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(100, 100%, 55%)" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
              
              {/* Concentric circles */}
              <div className="absolute inset-0 flex items-center justify-center">
                {[200, 150, 100, 50].map((size) => (
                  <div
                    key={size}
                    className="absolute border border-acid/20 rounded-full"
                    style={{
                      width: size,
                      height: size,
                    }}
                  />
                ))}
              </div>

              {/* Scanline effect */}
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <div 
                  className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-acid/50 to-transparent animate-scanline"
                  style={{ animationDuration: '8s' }}
                />
              </div>
            </div>

            {/* Threat Points */}
            <div className="relative z-10 h-full">
              {threats.slice(0, 20).map((threat, index) => {
                // Calculate position based on threat data
                const angle = (index * 137.5) % 360; // Golden angle for distribution
                const radius = 50 + (threat.risk_level * 15); // Risk level determines distance
                const x = 50 + (radius * Math.cos((angle * Math.PI) / 180)) / 2.5;
                const y = 50 + (radius * Math.sin((angle * Math.PI) / 180)) / 2.5;
                
                const getThreatColor = () => {
                  if (threat.risk_level >= 8) return 'bg-reaper';
                  if (threat.risk_level >= 5) return 'bg-orange-500';
                  return 'bg-yellow-500';
                };

                return (
                  <div
                    key={`${threat.timestamp}-${index}`}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div 
                      className={cn(
                        "w-3 h-3 rounded-full animate-pulse",
                        getThreatColor(),
                        "shadow-lg"
                      )}
                      style={{
                        boxShadow: `0 0 ${10 + threat.risk_level * 2}px ${getThreatColor().replace('bg-', '')}`,
                      }}
                    />
                    
                    {/* Tooltip */}
                    <div className="absolute left-6 top-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-card border border-border rounded-lg p-3 min-w-[200px] shadow-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-foreground">
                            {threat.threat_type}
                          </span>
                          <Badge 
                            className={cn(
                              "text-xs",
                              threat.risk_level >= 8 
                                ? "bg-reaper text-white" 
                                : threat.risk_level >= 5
                                ? "bg-orange-500 text-white"
                                : "bg-yellow-500 text-black"
                            )}
                          >
                            {threat.risk_level}/10
                          </Badge>
                        </div>
                        <code className="text-xs text-acid font-mono block mb-1">
                          {threat.source_ips[0]}
                        </code>
                        <p className="text-xs text-muted-foreground">
                          {threat.action_taken}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(threat.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Center indicator */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-4 h-4 rounded-full bg-acid animate-pulse" />
                <div className="absolute inset-0 w-4 h-4 rounded-full bg-acid animate-ping opacity-50" />
              </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-reaper" />
                <span className="text-muted-foreground">High Risk (8-10)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">Medium Risk (5-7)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Low Risk (1-4)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
