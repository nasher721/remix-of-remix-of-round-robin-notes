import { Wifi, WifiOff, Cloud, RefreshCw, Trash2, Clock, AlertTriangle } from 'lucide-react';
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
    failedCount,
    isSyncing,
    syncProgress,
    lastSyncTime,
    triggerSync,
    retryFailed,
    resolveSkippedConflict,
    clearQueue,
    skippedMutations,
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
          className={`gap-2 ${!isOnline || failedCount > 0 ? 'text-destructive' : pendingCount > 0 ? 'text-yellow-500' : ''}`}
          aria-label={
            !isOnline
              ? `Offline${pendingCount > 0 ? `, ${pendingCount} pending changes` : ""}`
              : failedCount > 0
                ? `Save failed, ${failedCount} changes need retry`
                : pendingCount > 0
                ? `Online, ${pendingCount} changes waiting to sync`
                : "Online"
          }
          aria-haspopup="dialog"
        >
          {isOnline ? (
            pendingCount > 0 ? (
              <>
                <Cloud className="h-4 w-4 shrink-0" aria-hidden />
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              </>
            ) : (
              <Wifi className="h-4 w-4 shrink-0" aria-hidden />
            )
          ) : (
            <>
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
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
                    {failedCount > 0 ? `Save failed (${failedCount})` : `Pending Changes (${pendingCount})`}
                  </span>
                  {isOnline && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={failedCount > 0 ? retryFailed : triggerSync}
                          aria-label={failedCount > 0 ? "Retry failed changes" : "Sync now"}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{failedCount > 0 ? "Retry failed changes" : "Sync now"}</TooltipContent>
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
          
          {/* Skipped/Conflicted Mutations */}
          {skippedMutations.length > 0 && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Conflicts ({skippedMutations.length})
                  </span>
                </div>
                
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {skippedMutations.map((skipped) => (
                      <div
                        key={skipped.id}
                        className="space-y-2 rounded bg-yellow-50 px-2 py-2 text-xs dark:bg-yellow-950/30"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[10px] border-yellow-500 text-yellow-700"
                            >
                              {skipped.mutation.operation}
                            </Badge>
                            <span className="text-muted-foreground">
                              {skipped.mutation.type}
                            </span>
                          </div>
                          <span className="text-yellow-600 text-[10px]">Server newer</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 flex-1"
                            onClick={() => void resolveSkippedConflict(skipped, 'server-wins')}
                          >
                            Use server
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 flex-1"
                            onClick={() => void resolveSkippedConflict(skipped, 'client-wins')}
                          >
                            Keep mine
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <p className="text-xs text-muted-foreground">
                  Server and local changes are both retained until you choose which version to keep.
                </p>
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
                onClick={failedCount > 0 ? retryFailed : triggerSync}
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
                    {failedCount > 0 ? "Retry Failed" : "Sync Now"}
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
                    aria-label="Discard pending changes"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discard pending changes</TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {!isOnline && (
            <p className="text-xs text-muted-foreground text-center">
              {pendingCount > 0
                ? "Listed patient changes are stored on this device and will retry after reconnect."
                : "Edits are stored only after the interface confirms Offline queued. Keep a recovery copy for critical notes."}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
