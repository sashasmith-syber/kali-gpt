import { useState } from 'react';
import { 
  Shield, 
  Sliders, 
  CheckCircle,
  AlertTriangle,
  Flame,
  Scan,
  Lock,
  Unlock,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useNetReaper } from '@/hooks/useNetReaper';
import type { ResponseProfile } from '@/types';

const profiles: ResponseProfile[] = ['passive', 'defensive', 'aggressive', 'scorched_earth'];

const profileConfig = {
  passive: {
    name: 'Passive',
    icon: Shield,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Monitor only, no blocking',
    threshold: 10,
  },
  defensive: {
    name: 'Defensive',
    icon: CheckCircle,
    color: 'text-cyber',
    bgColor: 'bg-cyber/20',
    description: 'Block confirmed threats (threshold 8+)',
    threshold: 8,
  },
  aggressive: {
    name: 'Aggressive',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    description: 'Block + scan back (threshold 6+)',
    threshold: 6,
  },
  scorched_earth: {
    name: 'Scorched Earth',
    icon: Flame,
    color: 'text-reaper',
    bgColor: 'bg-reaper/20',
    description: 'Maximum response (threshold 4+)',
    threshold: 4,
  },
};

export function ReaperControl() {
  const { 
    health, 
    currentProfile,
    switchProfile,
    blockIp,
    unblockIp,
    scanIp,
  } = useNetReaper();

  const [ipToBlock, setIpToBlock] = useState('');
  const [ipToUnblock, setIpToUnblock] = useState('');
  const [ipToScan, setIpToScan] = useState('');
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<ResponseProfile | null>(null);

  const handleProfileChange = (profile: ResponseProfile) => {
    if (profile !== currentProfile) {
      setPendingProfile(profile);
      setShowProfileConfirm(true);
    }
  };

  const confirmProfileSwitch = async () => {
    if (pendingProfile) {
      await switchProfile(pendingProfile);
      setShowProfileConfirm(false);
      setPendingProfile(null);
    }
  };

  const handleBlockIp = async () => {
    if (ipToBlock && isValidIp(ipToBlock)) {
      await blockIp(ipToBlock, 'Manual block from Command Center');
      setIpToBlock('');
    }
  };

  const handleUnblockIp = async () => {
    if (ipToUnblock && isValidIp(ipToUnblock)) {
      await unblockIp(ipToUnblock);
      setIpToUnblock('');
    }
  };

  const handleScanIp = async () => {
    if (ipToScan && isValidIp(ipToScan)) {
      await scanIp(ipToScan);
      setIpToScan('');
    }
  };

  const isValidIp = (ip: string): boolean => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  };

  const currentProfileConfig = profileConfig[currentProfile];
  const ProfileIcon = currentProfileConfig.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Profile Control */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Sliders className="w-4 h-4 text-acid" />
            Response Profile
            <Badge 
              className={cn(
                "ml-auto border-0",
                currentProfileConfig.bgColor,
                currentProfileConfig.color
              )}
            >
              <ProfileIcon className="w-3 h-3 mr-1" />
              {currentProfileConfig.name}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {currentProfileConfig.description}
          </p>

          {/* Profile Slider */}
          <div className="space-y-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Passive</span>
              <span>Scorched Earth</span>
            </div>
            
            <div className="relative">
              <Slider
                value={[profiles.indexOf(currentProfile)]}
                min={0}
                max={profiles.length - 1}
                step={1}
                className="w-full"
                onValueChange={(value) => {
                  const newProfile = profiles[value[0]];
                  handleProfileChange(newProfile);
                }}
              />
              
              {/* Profile labels */}
              <div className="flex justify-between mt-2 text-xs">
                {profiles.map((profile) => {
                  const config = profileConfig[profile];
                  const Icon = config.icon;
                  return (
                    <button
                      key={profile}
                      onClick={() => handleProfileChange(profile)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded transition-colors",
                        currentProfile === profile 
                          ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="text-[10px]">{config.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Health Stats */}
          {health && (
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-lg font-bold text-acid">{health.threats_blocked}</p>
                <p className="text-xs text-muted-foreground">Threats Blocked</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">
                  {Math.floor(health.uptime / 3600)}h
                </p>
                <p className="text-xs text-muted-foreground">Uptime</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IP Management */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Settings className="w-4 h-4 text-cyber" />
            IP Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Block IP */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Block IP Address
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., 203.0.113.5"
                value={ipToBlock}
                onChange={(e) => setIpToBlock(e.target.value)}
                className="flex-1 bg-secondary border-border text-sm"
              />
              <Button 
                size="sm" 
                onClick={handleBlockIp}
                disabled={!ipToBlock || !isValidIp(ipToBlock)}
                className="bg-reaper hover:bg-reaper/80 text-white"
              >
                <Lock className="w-4 h-4 mr-1" />
                Block
              </Button>
            </div>
          </div>

          {/* Unblock IP */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Unblock IP Address
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., 203.0.113.5"
                value={ipToUnblock}
                onChange={(e) => setIpToUnblock(e.target.value)}
                className="flex-1 bg-secondary border-border text-sm"
              />
              <Button 
                size="sm" 
                onClick={handleUnblockIp}
                disabled={!ipToUnblock || !isValidIp(ipToUnblock)}
                variant="outline"
                className="border-acid text-acid hover:bg-acid hover:text-background"
              >
                <Unlock className="w-4 h-4 mr-1" />
                Unblock
              </Button>
            </div>
          </div>

          {/* Scan IP */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Reconnaissance Scan
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., 198.51.100.23"
                value={ipToScan}
                onChange={(e) => setIpToScan(e.target.value)}
                className="flex-1 bg-secondary border-border text-sm"
              />
              <Button 
                size="sm" 
                onClick={handleScanIp}
                disabled={!ipToScan || !isValidIp(ipToScan)}
                variant="outline"
                className="border-cyber text-cyber hover:bg-cyber hover:text-background"
              >
                <Scan className="w-4 h-4 mr-1" />
                Scan
              </Button>
            </div>
          </div>

          {/* Whitelist Note */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Whitelisted IPs:</strong> 127.0.0.1, ::1, 192.168.1.0/24
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Profile Change Confirmation Dialog */}
      <Dialog open={showProfileConfirm} onOpenChange={setShowProfileConfirm}>
        <DialogContent className="glass-panel border-reaper/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-reaper">
              <AlertTriangle className="w-5 h-5" />
              Confirm Profile Change
            </DialogTitle>
            <DialogDescription>
              {pendingProfile === 'scorched_earth' && (
                <span className="text-reaper font-medium">
                  WARNING: Scorched Earth mode will trigger maximum response to all threats. 
                  This may cause collateral damage to legitimate traffic.
                </span>
              )}
              {pendingProfile === 'aggressive' && (
                <span>
                  Aggressive mode will enable counter-reconnaissance (nmap scans) 
                  against detected attackers. Ensure this is authorized.
                </span>
              )}
              {pendingProfile === 'defensive' && (
                <span>
                  Switch to defensive mode? This will block confirmed high-risk threats.
                </span>
              )}
              {pendingProfile === 'passive' && (
                <span>
                  Switch to passive mode? No blocking will occur - monitoring only.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowProfileConfirm(false);
                setPendingProfile(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmProfileSwitch}
              className={cn(
                pendingProfile === 'scorched_earth' && "bg-reaper hover:bg-reaper/80 text-white"
              )}
            >
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
