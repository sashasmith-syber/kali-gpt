import { useState } from 'react';
import { 
  Globe, 
  Play,
  Shield,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSpider } from '@/hooks/useSpider';
import type { SpiderCrawl, ThreatIntelFeed } from '@/types';
import { formatDistanceToNow } from 'date-fns';

export function SpiderControl() {
  const { 
    crawls, 
    intelFeeds, 
    health, 
    startCrawl,
    toggleIntelFeed,
    getStatusColor,
    formatBytes,
  } = useSpider();

  const [newCrawlUrl, setNewCrawlUrl] = useState('');
  const [newCrawlTopic, setNewCrawlTopic] = useState('');

  const handleStartCrawl = async () => {
    if (newCrawlUrl && newCrawlTopic) {
      const urls = newCrawlUrl.split(',').map(u => u.trim()).filter(u => u);
      await startCrawl(urls, newCrawlTopic);
      setNewCrawlUrl('');
      setNewCrawlTopic('');
    }
  };

  const getTotalActiveEntries = () => {
    return intelFeeds.reduce((sum: number, f: ThreatIntelFeed) => 
      sum + (f.enabled ? f.entries_count : 0), 0
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Crawl Queue */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Globe className="w-4 h-4 text-acid" />
            Crawl Queue
            {health && (
              <Badge variant="outline" className="ml-auto">
                {health.active_crawls} active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New Crawl Form */}
          <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border">
            <Input
              placeholder="URLs (comma-separated)"
              value={newCrawlUrl}
              onChange={(e) => setNewCrawlUrl(e.target.value)}
              className="bg-background border-border text-sm"
            />
            <Input
              placeholder="Topic/Tag"
              value={newCrawlTopic}
              onChange={(e) => setNewCrawlTopic(e.target.value)}
              className="bg-background border-border text-sm"
            />
            <Button 
              size="sm" 
              onClick={handleStartCrawl}
              disabled={!newCrawlUrl || !newCrawlTopic}
              className="w-full bg-acid hover:bg-acid/80 text-background"
            >
              <Play className="w-4 h-4 mr-1" />
              Start Crawl
            </Button>
          </div>

          {/* Active Crawls */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {crawls.map((crawl: SpiderCrawl) => (
              <div 
                key={crawl.id}
                className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-acid/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <code className="text-xs text-acid font-mono truncate max-w-[150px]">
                    {crawl.url}
                  </code>
                  <Badge 
                    variant="outline" 
                    className={cn("text-[10px]", getStatusColor(crawl.status))}
                  >
                    {crawl.status}
                  </Badge>
                </div>
                
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{crawl.pages_crawled} pages</span>
                    <span>{formatBytes(crawl.bytes_downloaded)}</span>
                  </div>
                  <Progress 
                    value={crawl.progress} 
                    className="h-1 bg-muted"
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{crawl.start_time ? 'Crawling' : 'Queued'}</span>
                  {crawl.start_time && (
                    <span>
                      {formatDistanceToNow(new Date(crawl.start_time), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {crawls.length === 0 && (
              <div className="text-center py-8">
                <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No active crawls
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Threat Intel Feeds */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Shield className="w-4 h-4 text-cyber" />
            Threat Intelligence Feeds
            {health && (
              <Badge variant="outline" className="ml-auto">
                {health.feeds_enabled} enabled
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feed List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {intelFeeds.map((feed: ThreatIntelFeed) => (
              <div 
                key={feed.id}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  feed.enabled 
                    ? "bg-cyber/10 border-cyber/30" 
                    : "bg-secondary/30 border-border"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {feed.name}
                    </p>
                    <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px] block">
                      {feed.url}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant={feed.enabled ? "default" : "outline"}
                    onClick={() => toggleIntelFeed(feed.id, !feed.enabled)}
                    className={cn(
                      feed.enabled && "bg-cyber hover:bg-cyber/80 text-white"
                    )}
                  >
                    {feed.enabled ? (
                      <><CheckCircle className="w-3 h-3 mr-1" /> Enabled</>
                    ) : (
                      <><XCircle className="w-3 h-3 mr-1" /> Disabled</>
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{feed.entries_count.toLocaleString()} entries</span>
                  {feed.last_update && (
                    <span>
                      Updated {formatDistanceToNow(new Date(feed.last_update), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {intelFeeds.length === 0 && (
              <div className="text-center py-8">
                <Database className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No threat intel feeds configured
                </p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold text-foreground">
                {getTotalActiveEntries().toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Active Entries</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold text-acid">
                {health?.completed_today || 0}
              </p>
              <p className="text-xs text-muted-foreground">Crawls Today</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="glass-panel lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-acid" />
                Crawl completed: React documentation
              </span>
              <span className="text-xs text-muted-foreground">5 min ago</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyber" />
                Threat intel updated: Emerging Threats
              </span>
              <span className="text-xs text-muted-foreground">12 min ago</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                Crawl queued: Arduino sensor datasheets
              </span>
              <span className="text-xs text-muted-foreground">25 min ago</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Obsidian note created: Electronics/MPU6050.md
              </span>
              <span className="text-xs text-muted-foreground">1 hour ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
