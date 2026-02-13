import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AIModelSettingsPanel } from "@/components/settings/AIModelSettingsPanel";

export function DesktopAIModelSettingsDialog() {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          AI Models
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>AI Models</DialogTitle>
          <DialogDescription>
            Choose a default model and manage provider credentials for desktop.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <AIModelSettingsPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}
