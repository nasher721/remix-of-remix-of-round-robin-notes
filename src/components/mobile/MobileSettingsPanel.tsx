import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Type,
  ArrowUpDown,
  Palette,
  LogOut,
  Printer,
  Trash2,
  Sparkles,
  PenLine,
  ListTodo,
  FileText,
  TestTube,
} from "lucide-react";

interface MobileSettingsPanelProps {
  globalFontSize: number;
  onFontSizeChange: (size: number) => void;
  sortBy: "number" | "room" | "name";
  onSortChange: (sort: "number" | "room" | "name") => void;
  changeTracking: {
    enabled: boolean;
    color: string;
    styles: { textColor: boolean; backgroundColor: boolean; italic: boolean };
    toggleEnabled: () => void;
    setColor: (color: string) => void;
    toggleStyle: (style: "textColor" | "backgroundColor" | "italic") => void;
  };
  onSignOut: () => void;
  onOpenPrint: () => void;
  onClearAll: () => void;
  onOpenAutotexts: () => void;
  onOpenPhrases: () => void;
  userEmail?: string;
  todosAlwaysVisible?: boolean;
  onTodosAlwaysVisibleChange?: (visible: boolean) => void;
  showLabFishbones?: boolean;
  onShowLabFishbonesChange?: (show: boolean) => void;
}

const colorPresets = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
];

export const MobileSettingsPanel = ({
  globalFontSize,
  onFontSizeChange,
  sortBy,
  onSortChange,
  changeTracking,
  onSignOut,
  onOpenPrint,
  onClearAll,
  onOpenAutotexts,
  onOpenPhrases,
  userEmail,
  todosAlwaysVisible = false,
  onTodosAlwaysVisibleChange,
  showLabFishbones = true,
  onShowLabFishbonesChange,
}: MobileSettingsPanelProps) => {
  return (
    <div className="p-4 space-y-4 pb-24">
      <h2 className="text-xl font-semibold mb-2">Settings</h2>
      {userEmail && (
        <p className="text-sm text-muted-foreground mb-4">{userEmail}</p>
      )}

      {/* Display Settings */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Type className="h-4 w-4" />
          Display
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Font Size</span>
            <span className="text-sm font-mono text-muted-foreground w-12 text-right">
              {globalFontSize}px
            </span>
          </div>
          <Slider
            value={[globalFontSize]}
            min={12}
            max={24}
            step={1}
            onValueChange={(v) => onFontSizeChange(v[0])}
            className="w-full"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Sort By</span>
          </div>
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as "number" | "room" | "name")}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Order Added</SelectItem>
              <SelectItem value="room">Room</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Todos Visibility */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Todos Always Visible</span>
          </div>
          <Switch
            checked={todosAlwaysVisible}
            onCheckedChange={onTodosAlwaysVisibleChange}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Show todos inline instead of in a popup
        </p>
      </Card>

      {/* Lab Fishbone Toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Lab Fishbone Display</span>
          </div>
          <Switch
            checked={showLabFishbones}
            onCheckedChange={onShowLabFishbonesChange}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Show BMP/CBC in graphical fishbone format
        </p>
      </Card>

      {/* Change Tracking */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Mark New Text
          </h3>
          <Switch
            checked={changeTracking.enabled}
            onCheckedChange={changeTracking.toggleEnabled}
          />
        </div>

        {changeTracking.enabled && (
          <div className="space-y-4 pt-2 animate-fade-in">
            {/* Color Selection */}
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Highlight Color</span>
              <div className="flex items-center gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    onClick={() => changeTracking.setColor(color)}
                    className={`h-8 w-8 rounded-full transition-transform ${
                      changeTracking.color === color
                        ? "ring-2 ring-offset-2 ring-primary scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Style Toggles */}
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Apply Style</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={changeTracking.styles.textColor ? "default" : "outline"}
                  size="sm"
                  onClick={() => changeTracking.toggleStyle("textColor")}
                >
                  Text Color
                </Button>
                <Button
                  variant={changeTracking.styles.backgroundColor ? "default" : "outline"}
                  size="sm"
                  onClick={() => changeTracking.toggleStyle("backgroundColor")}
                >
                  Highlight
                </Button>
                <Button
                  variant={changeTracking.styles.italic ? "default" : "outline"}
                  size="sm"
                  onClick={() => changeTracking.toggleStyle("italic")}
                >
                  Italic
                </Button>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-secondary/50 rounded-lg">
              <span className="text-xs text-muted-foreground block mb-1">Preview:</span>
              <span
                style={{
                  color: changeTracking.styles.textColor ? changeTracking.color : undefined,
                  backgroundColor: changeTracking.styles.backgroundColor
                    ? `${changeTracking.color}25`
                    : undefined,
                  fontStyle: changeTracking.styles.italic ? "italic" : undefined,
                  padding: changeTracking.styles.backgroundColor ? "0.125rem 0.25rem" : undefined,
                  borderRadius: changeTracking.styles.backgroundColor ? "0.25rem" : undefined,
                }}
              >
                New text will look like this
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-4 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>

        <Button
          variant="ghost"
          className="w-full justify-start h-12"
          onClick={onOpenPhrases}
        >
          <FileText className="h-4 w-4 mr-3" />
          Clinical Phrases
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start h-12"
          onClick={onOpenAutotexts}
        >
          <Sparkles className="h-4 w-4 mr-3" />
          Autotexts & Templates
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start h-12"
          onClick={onOpenPrint}
        >
          <Printer className="h-4 w-4 mr-3" />
          Print / Export
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onClearAll}
        >
          <Trash2 className="h-4 w-4 mr-3" />
          Clear All Patients
        </Button>
      </Card>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="w-full h-12"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
};
