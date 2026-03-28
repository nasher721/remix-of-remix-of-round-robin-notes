import * as React from "react";
import { usePatientActivity, type ActivityAction } from "@/hooks/usePatientActivity";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Edit3,
  UserCheck,
  Download,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<ActivityAction, { icon: React.ElementType; label: string; color: string }> = {
  created: { icon: Plus, label: "Created", color: "text-green-500" },
  updated: { icon: Edit3, label: "Updated", color: "text-blue-500" },
  assigned: { icon: UserCheck, label: "Assigned", color: "text-purple-500" },
  exported: { icon: Download, label: "Exported", color: "text-orange-500" },
  ai_used: { icon: Sparkles, label: "AI Used", color: "text-pink-500" },
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

interface ActivityFeedProps {
  patientId: string;
  patientName?: string;
  maxItems?: number;
  className?: string;
}

export function ActivityFeed({
  patientId,
  patientName,
  maxItems = 5,
  className,
}: ActivityFeedProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { activities, loading, fetchActivities } = usePatientActivity(patientId);

  React.useEffect(() => {
    if (isOpen && patientId) {
      fetchActivities(10);
    }
  }, [isOpen, patientId, fetchActivities]);

  const displayedActivities = activities.slice(0, maxItems);
  const hasMore = activities.length > maxItems;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("flex items-center gap-1.5 text-muted-foreground hover:text-foreground", className)}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs">Activity</span>
          {activities.length > 0 && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
              {activities.length}
            </span>
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-xs">
              No activity yet
            </div>
          ) : (
            <ScrollArea className="h-[200px] pr-2">
              <div className="space-y-2">
                {displayedActivities.map((activity, index) => {
                  const config = ACTION_CONFIG[activity.action];
                  const Icon = config.icon;

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "p-1 rounded-full",
                            `${config.color} bg-current/10`
                          )}
                        >
                          <Icon className={cn("h-3 w-3", config.color)} />
                        </div>
                        {index < displayedActivities.length - 1 && (
                          <div className="w-px h-full bg-border flex-1 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{config.label}</span>
                          {activity.fieldName && (
                            <span className="text-muted-foreground truncate">
                              ({activity.fieldName})
                            </span>
                          )}
                        </div>
                        {activity.summary && (
                          <p className="text-muted-foreground truncate mt-0.5">
                            {activity.summary}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatRelativeTime(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => fetchActivities(20)}
                  >
                    Show more ({activities.length - maxItems} more)
                  </Button>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
