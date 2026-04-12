import { useState } from 'react';
import { 
  Shield, 
  Radar, 
  FileText, 
  Bot,
  Settings,
  Activity,
  Network
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewType = 'overview' | 'threats' | 'incidents' | 'spider' | 'settings';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const menuItems = [
  { id: 'overview' as ViewType, label: 'SOC Overview', icon: Activity },
  { id: 'threats' as ViewType, label: 'Threat Radar', icon: Radar },
  { id: 'incidents' as ViewType, label: 'Incidents', icon: FileText },
  { id: 'spider' as ViewType, label: 'Spider & Intel', icon: Network },
  { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
];

const statusItems = [
  { label: 'Net-Reaper', status: 'live' as const },
  { label: 'K2 Security', status: 'live' as const },
  { label: 'Obsidian', status: 'live' as const },
  { label: 'Spider', status: 'warning' as const },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getStatusIndicator = (status: 'live' | 'warning' | 'error') => {
    switch (status) {
      case 'live':
        return <span className="status-indicator status-live" title="Live" />;
      case 'warning':
        return <span className="status-indicator status-warning" title="Warning" />;
      case 'error':
        return <span className="status-indicator status-danger" title="Error" />;
      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-acid flex-shrink-0" />
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">
                Net-Reaper
              </h1>
              <p className="text-xs text-sidebar-foreground/60">
                Command Center v1.0
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="p-3 border-b border-sidebar-border">
        <div className={cn(
          "flex items-center gap-2",
          isCollapsed ? "justify-center" : ""
        )}>
          <span className="status-indicator status-live animate-pulse" />
          {!isCollapsed && (
            <span className="text-xs text-acid font-mono uppercase tracking-wider">
              Live Monitoring
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/80"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive && "text-acid"
                  )} />
                  {!isCollapsed && (
                    <span>{item.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* System Status */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn(
          "space-y-2",
          isCollapsed ? "flex flex-col items-center gap-3" : ""
        )}>
          {!isCollapsed && (
            <h3 className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">
              System Status
            </h3>
          )}
          {statusItems.map((item) => (
            <div 
              key={item.label}
              className={cn(
                "flex items-center gap-2",
                isCollapsed ? "justify-center" : ""
              )}
            >
              {getStatusIndicator(item.status)}
              {!isCollapsed && (
                <span className="text-xs text-sidebar-foreground/80">
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Bot className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
