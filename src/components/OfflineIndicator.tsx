import { Wifi, WifiOff, Cloud, RefreshCw, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { formatDistanceToNow } from 'date-fns';

export function OfflineIndicator() {
  const {
    isOnline,
    pendingCount,
    pendingMutations,
    isSyncing,
    syncProgress,
    lastSyncTime,
    triggerSync,
    clearQueue,
  } = useOfflineMode();
  
  // Don't show anything if online with no pending changes
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-2 ${!isOnline ? 'text-destructive' : pendingCount > 0 ? 'text-yellow-500' : ''}`}
        >
          {isOnline ? (
            pendingCount > 0 ? (
              <>
                <Cloud className="h-4 w-4" />
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              </>
            ) : (
              <Wifi className="h-4 w-4" />
            )
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-500">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">Offline</span>
                </>
              )}
            </div>
            
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
              </span>
            )}
          </div>
          
          {/* Sync Progress */}
          {isSyncing && syncProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Syncing...</span>
                <span className="font-mono text-xs">
                  {syncProgress.completed}/{syncProgress.total}
                </span>
              </div>
              <Progress 
                value={(syncProgress.completed / syncProgress.total) * 100} 
                className="h-2"
              />
              {syncProgress.current && (
                <p className="text-xs text-muted-foreground truncate">
                  {syncProgress.current}
                </p>
              )}
            </div>
          )}
          
          {/* Pending Mutations */}
          {pendingCount > 0 && !isSyncing && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Pending Changes ({pendingCount})
                  </span>
                  {isOnline && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={triggerSync}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sync now</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {pendingMutations.slice(0, 10).map((mutation) => (
                      <div
                        key={mutation.id}
                        className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              mutation.operation === 'create' ? 'default' :
                              mutation.operation === 'update' ? 'secondary' :
                              'destructive'
                            }
                            className="h-4 px-1 text-[10px]"
                          >
                            {mutation.operation}
                          </Badge>
                          <span className="text-muted-foreground">
                            {mutation.type}
                          </span>
                        </div>
                        {mutation.retryCount > 0 && (
                          <span className="text-muted-foreground">
                            retry {mutation.retryCount}
                          </span>
                        )}
                      </div>
                    ))}
                    {pendingMutations.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        +{pendingMutations.length - 10} more
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
          
          {/* Actions */}
          <Separator />
          
          <div className="flex gap-2">
            {isOnline && pendingCount > 0 && (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={triggerSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4 mr-1.5" />
                    Sync Now
                  </>
                )}
              </Button>
            )}
            
            {pendingCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearQueue}
                    disabled={isSyncing}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discard pending changes</TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {!isOnline && (
            <p className="text-xs text-muted-foreground text-center">
              Changes will sync when you're back online
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
