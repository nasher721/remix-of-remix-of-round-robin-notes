import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, FileUp, Clipboard } from "lucide-react";

interface MobileAddPanelProps {
  onAddPatient: () => void;
  onOpenImport: () => void;
}

export const MobileAddPanel = ({ onAddPatient, onOpenImport }: MobileAddPanelProps) => {
  return (
    <div className="p-4 space-y-4 pb-20">
      <h2 className="text-xl font-semibold mb-4">Add Patients</h2>

      <Card 
        className="p-6 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors"
        onClick={onAddPatient}
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Plus className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">New Patient</h3>
            <p className="text-sm text-muted-foreground">
              Add a blank patient card to start documenting
            </p>
          </div>
        </div>
      </Card>

      <Card 
        className="p-6 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors"
        onClick={onOpenImport}
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <FileUp className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Import Epic Handoff</h3>
            <p className="text-sm text-muted-foreground">
              Upload PDF or paste handoff text
            </p>
          </div>
        </div>
      </Card>

      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Type autotext shortcuts followed by space to expand</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Paste images directly into imaging fields</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>All changes sync automatically to the cloud</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
