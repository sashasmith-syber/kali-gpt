import { useState } from 'react';
import { 
  Shield, 
  Database,
  FileText,
  Bot,
  Key,
  TestTube,
  Save,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ConnectionStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  latency?: number;
  details?: string;
}

export function SettingsPanel() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [connections, setConnections] = useState<ConnectionStatus[]>([
    { name: 'Net-Reaper API', status: 'connected', latency: 12 },
    { name: 'K2 Security Hub', status: 'connected', latency: 45 },
    { name: 'ZeroMQ Bus', status: 'connected', latency: 2 },
    { name: 'Obsidian Vault', status: 'connected', details: '~/obsidian-vault' },
    { name: 'Hybrid VCS', status: 'connected', details: '~/hybrid-vcs-repo' },
    { name: 'Spider Entity', status: 'connected' },
  ]);

  const [settings, setSettings] = useState({
    netreaperUrl: 'http://localhost:8000',
    zmqEndpoint: 'tcp://127.0.0.1:5555',
    obsidianVault: '~/Development/obsidian-vault',
    vcsRepo: '~/Development/hybrid-vcs-repo',
    kimiApiKey: 'sk-****************************',
    kimiModel: 'kimi-k2-latest',
  });

  const testConnection = (name: string) => {
    // Simulate connection test
    setConnections(prev => 
      prev.map(conn => 
        conn.name === name 
          ? { ...conn, status: 'connected' as const, latency: Math.floor(Math.random() * 100) }
          : conn
      )
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-acid" />;
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-reaper" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-orange-400" />;
      default:
        return <TestTube className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Connection Status */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TestTube className="w-4 h-4 text-acid" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {connections.map((connection) => (
            <div 
              key={connection.name}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(connection.status)}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {connection.name}
                  </p>
                  {connection.details && (
                    <code className="text-xs text-muted-foreground font-mono">
                      {connection.details}
                    </code>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {connection.latency && (
                  <Badge variant="outline" className="text-xs">
                    {connection.latency}ms
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testConnection(connection.name)}
                  className="text-xs border-acid text-acid hover:bg-acid hover:text-background"
                >
                  Test
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Net-Reaper Settings */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Shield className="w-4 h-4 text-reaper" />
            Net-Reaper API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              API Base URL
            </label>
            <Input
              type="url"
              value={settings.netreaperUrl}
              onChange={(e) => setSettings(prev => ({ ...prev, netreaperUrl: e.target.value }))}
              className="bg-secondary border-border text-sm"
              placeholder="http://localhost:8000"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              ZeroMQ Endpoint
            </label>
            <Input
              type="text"
              value={settings.zmqEndpoint}
              onChange={(e) => setSettings(prev => ({ ...prev, zmqEndpoint: e.target.value }))}
              className="bg-secondary border-border text-sm"
              placeholder="tcp://127.0.0.1:5555"
            />
          </div>

          <div className="p-3 rounded-lg bg-cyber/10 border border-cyber/30">
            <p className="text-xs text-cyber">
              <strong>Curve25519 Keys:</strong> Keys are loaded from ~/.local/share/net-reaper/.env.curve
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Obsidian & VCS Settings */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4 text-cyber" />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Obsidian Vault Path
            </label>
            <Input
              type="text"
              value={settings.obsidianVault}
              onChange={(e) => setSettings(prev => ({ ...prev, obsidianVault: e.target.value }))}
              className="bg-secondary border-border text-sm font-mono"
              placeholder="~/Development/obsidian-vault"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Hybrid VCS Repo Path
            </label>
            <Input
              type="text"
              value={settings.vcsRepo}
              onChange={(e) => setSettings(prev => ({ ...prev, vcsRepo: e.target.value }))}
              className="bg-secondary border-border text-sm font-mono"
              placeholder="~/Development/hybrid-vcs-repo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              size="sm" 
              variant="outline"
              className="border-acid text-acid hover:bg-acid hover:text-background"
            >
              <FileText className="w-4 h-4 mr-1" />
              Open Vault
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-cyber text-cyber hover:bg-cyber hover:text-background"
            >
              <Database className="w-4 h-4 mr-1" />
              Browse VCS
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kimi K2 Settings */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Bot className="w-4 h-4 text-acid" />
            Kimi K2 Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              API Key
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={settings.kimiApiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, kimiApiKey: e.target.value }))}
                className="bg-secondary border-border text-sm font-mono pr-10"
                placeholder="sk-****************************"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Model
            </label>
            <Input
              type="text"
              value={settings.kimiModel}
              onChange={(e) => setSettings(prev => ({ ...prev, kimiModel: e.target.value }))}
              className="bg-secondary border-border text-sm"
              placeholder="kimi-k2-latest"
            />
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Permissions:</strong> Kimi K2 can access incident data, threat logs, 
              and system status to provide analysis and recommendations.
            </p>
          </div>

          <Button 
            size="sm" 
            className="w-full bg-acid hover:bg-acid/80 text-background"
          >
            <Key className="w-4 h-4 mr-1" />
            Test Kimi Connection
          </Button>
        </CardContent>
      </Card>

      {/* Save Settings */}
      <Card className="glass-panel lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Save className="w-4 h-4 text-muted-foreground" />
            Save & Apply
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Settings are saved locally. Restart the application to apply changes.
          </p>
          <Button 
            className="bg-acid hover:bg-acid/80 text-background"
          >
            <Save className="w-4 h-4 mr-1" />
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
