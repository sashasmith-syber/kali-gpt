import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar, type ViewType } from '@/components/Sidebar';
import { Overview } from '@/components/Overview';
import { ThreatRadar } from '@/components/ThreatRadar';
import { IncidentsPanel } from '@/components/IncidentsPanel';
import { SpiderControl } from '@/components/SpiderControl';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Toaster } from '@/components/ui/sonner';
import { getBackendClient } from '@/backend-client';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize backend client
  useEffect(() => {
    const init = async () => {
      const client = getBackendClient();
      
      // Log audit entry for app start
      await client.logAuditEntry({
        user: 'system',
        action: 'app_start',
        details: { view: currentView },
        severity: 'info',
      });
      
      setIsLoading(false);
    };

    init();
  }, [currentView]);

  const renderView = () => {
    switch (currentView) {
      case 'overview':
        return <Overview />;
      case 'threats':
        return <ThreatRadar />;
      case 'incidents':
        return <IncidentsPanel />;
      case 'spider':
        return <SpiderControl />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <Overview />;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-acid border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Initializing Net-Reaper Command Center...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-4 lg:p-6">
          {/* Header */}
          <header className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Net-Reaper Command Center
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Autonomous Cyber Defense & Knowledge Management Platform
                </p>
              </div>
              
              {/* Status Indicators */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="status-indicator status-live" />
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-indicator status-live" />
                  <span className="text-xs text-muted-foreground">Curve25519</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-indicator status-live" />
                  <span className="text-xs text-muted-foreground">K2 Active</span>
                </div>
              </div>
            </div>
          </header>

          {/* View Content */}
          <div className={cn(
            "transition-opacity duration-300",
            currentView ? "opacity-100" : "opacity-0"
          )}>
            {renderView()}
          </div>
        </div>
      </main>

      {/* Toaster for notifications */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'hsl(0 0% 6%)',
            border: '1px solid hsl(0 0% 18%)',
            color: 'hsl(0 0% 98%)',
          },
        }}
      />
    </div>
  );
}

export default App;
