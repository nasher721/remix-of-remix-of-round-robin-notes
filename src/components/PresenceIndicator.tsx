import { usePresence } from '@/hooks/usePresence';
import { cn } from '@/lib/utils';

interface PresenceIndicatorProps {
  channelId?: string;
  maxDisplay?: number;
  showCount?: boolean;
  className?: string;
}

export function PresenceIndicator({
  channelId = 'global',
  maxDisplay = 3,
  showCount = true,
  className,
}: PresenceIndicatorProps) {
  const { users, totalOnline, isConnected } = usePresence(channelId);

  if (!isConnected || totalOnline === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex -space-x-2">
        {users.slice(0, maxDisplay).map((user) => (
          <div
            key={user.id}
            className="relative group"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || user.email}
                className="w-7 h-7 rounded-full border-2 border-background object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-background bg-primary flex items-center justify-center text-xs text-primary-foreground">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md">
              {user.name || user.email}
            </div>
          </div>
        ))}
        {users.length > maxDisplay && (
          <div className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs text-muted-foreground">
            +{users.length - maxDisplay}
          </div>
        )}
      </div>
      {showCount && totalOnline > 1 && (
        <span className="text-xs text-muted-foreground ml-1">
          {totalOnline} online
        </span>
      )}
    </div>
  );
}

interface PatientPresenceListProps {
  patientId: string;
  className?: string;
}

export function PatientPresenceList({ patientId, className }: PatientPresenceListProps) {
  const { users, isConnected } = usePresence(`patient-${patientId}`);

  if (!isConnected || users.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs text-muted-foreground font-medium">
        Currently viewing:
      </span>
      <div className="flex flex-wrap gap-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-full text-xs"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || user.email}
                className="w-4 h-4 rounded-full"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-primary-foreground">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <span>{user.name || user.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
