import * as React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FileText, Copy, Trash2, ChevronDown, ChevronUp, Clock, Sparkles, History, MoreHorizontal, ClipboardList } from "lucide-react";
import { PatientAcuityBadge } from "./PatientAcuityBadge";
import { QuickActionsPanel } from "./QuickActionsPanel";
import { SmartProtocolSuggestions, ProtocolBadge } from "./SmartProtocolSuggestions";
import { LabTrendBadge } from "./LabTrendingPanel";
import { AppleAIAssistant } from "./AppleAIAssistant";
import { FieldHistoryViewer } from "./FieldHistoryViewer";
import type { Patient } from "@/types/patient";

export interface PatientCardHeaderProps {
  patient: Patient;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onFieldUpdate: <T,>(field: string, value: T) => void;
  onToggleCollapse: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  isStreamingAI: boolean;
  aiMode: string | null;
  startAIMode: (mode: string) => void;
}

/**
 * PatientCardHeader - Extracted header component for PatientCard
 * 
 * Contains:
 * - Patient avatar and name/bed inputs
 * - Status badges (acuity, lab trend, protocol)
 * - Quick actions, protocol suggestions, AI assistant
 * - AI modes dropdown
 * - Collapse toggle and more actions menu
 */
export const PatientCardHeader = React.memo(function PatientCardHeader({
  patient,
  onUpdate,
  onFieldUpdate,
  onToggleCollapse,
  onDuplicate,
  onRemove,
  isStreamingAI,
  aiMode,
  startAIMode,
}: PatientCardHeaderProps) {
  return (
    <div className="flex justify-between items-center gap-4 px-5 py-3.5 bg-gradient-to-r from-secondary/20 to-secondary/10 border-b border-border/40 transition-colors group-hover:from-secondary/30 group-hover:to-secondary/15">
      <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 shadow-sm">
          <span className="text-base font-semibold text-primary">
            {patient.name ? patient.name.charAt(0).toUpperCase() : '#'}
          </span>
        </div>
        <div className="flex gap-2.5 flex-1 flex-wrap items-center">
          <Input
            placeholder="Patient Name"
            value={patient.name}
            onChange={(e) => onFieldUpdate('name', e.target.value)}
            aria-label="Patient name"
            className="max-w-[220px] font-medium bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-base text-foreground transition-all duration-200 shadow-none hover:shadow-sm focus:shadow-sm"
          />
          <Input
            placeholder="Bed/Room"
            value={patient.bed}
            onChange={(e) => onFieldUpdate('bed', e.target.value)}
            aria-label="Bed or room number"
            className="max-w-[110px] bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-sm text-muted-foreground font-medium transition-all duration-200 shadow-none hover:shadow-sm focus:shadow-sm"
          />
          {/* Patient Status Badges */}
          <div className="flex items-center gap-1.5 no-print">
            <PatientAcuityBadge patient={patient} size="sm" />
            <LabTrendBadge labText={patient.labs} />
            <ProtocolBadge patient={patient} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 no-print">
        {/* Quick Actions & Protocol Tools */}
        <QuickActionsPanel patient={patient} onUpdatePatient={onUpdate} />
        <SmartProtocolSuggestions patient={patient} />
        <AppleAIAssistant patient={patient} onUpdatePatient={onUpdate} compact />
        
        {/* AI Modes Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isStreamingAI}
              className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
              aria-label="AI modes"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              AI
              <ChevronDown className="h-3 w-3 ml-0.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">AI Modes</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => startAIMode('insights')}
              disabled={isStreamingAI}
              className="cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              Insights
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => startAIMode('delta')}
              disabled={isStreamingAI}
              className="cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              Delta
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => startAIMode('checklist')}
              disabled={isStreamingAI}
              className="cursor-pointer"
            >
              <ClipboardList className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              Checklist
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => startAIMode('handoff')}
              disabled={isStreamingAI}
              className="cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              SBAR
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="w-px h-4 bg-border/40 mx-1" />
        
        {/* Collapse Button - Primary Action */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
          aria-label={patient.collapsed ? "Expand patient card" : "Collapse patient card"}
          aria-expanded={!patient.collapsed}
          aria-controls={`patient-body-${patient.id}`}
        >
          {patient.collapsed ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />}
        </Button>
        
        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Actions</DropdownMenuLabel>
            <DropdownMenuItem className="cursor-pointer">
              <FieldHistoryViewer
                patientId={patient.id}
                patientName={patient.name}
                trigger={
                  <div className="flex items-center w-full">
                    <History className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                    <span>View History</span>
                  </div>
                }
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDuplicate}
              className="cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onRemove}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
