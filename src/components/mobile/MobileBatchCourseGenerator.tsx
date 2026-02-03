import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Check,
  X,
  Undo2,
  Users,
  Copy,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { useBatchCourseGenerator, BatchResult } from '@/hooks/useBatchCourseGenerator';
import type { Patient } from '@/types/patient';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MobileBatchCourseGeneratorProps {
  patients: Patient[];
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileBatchCourseGenerator = ({
  patients,
  onUpdatePatient,
  open,
  onOpenChange,
}: MobileBatchCourseGeneratorProps) => {
  const {
    generateBatchCourses,
    isGenerating,
    progress,
    cancelGeneration,
    undoLastBatch,
    canUndo,
  } = useBatchCourseGenerator();

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [autoInsert, setAutoInsert] = React.useState(true);
  const [results, setResults] = React.useState<BatchResult[]>([]);
  const [showResults, setShowResults] = React.useState(false);

  // Filter patients that have content
  const patientsWithContent = React.useMemo(() => {
    return patients.filter(patient => {
      const hasContent = 
        patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
        patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
        patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
        patient.labs?.replace(/<[^>]*>/g, '').trim() ||
        Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
      return hasContent;
    });
  }, [patients]);

  // Initialize selection with all patients that have content
  React.useEffect(() => {
    if (open && selectedIds.size === 0 && patientsWithContent.length > 0) {
      setSelectedIds(new Set(patientsWithContent.map(p => p.id)));
    }
  }, [open, patientsWithContent, selectedIds.size]);

  // Reset state when drawer closes
  React.useEffect(() => {
    if (!open) {
      setShowResults(false);
      setResults([]);
    }
  }, [open]);

  const togglePatient = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === patientsWithContent.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(patientsWithContent.map(p => p.id)));
    }
  };

  const handleGenerate = async () => {
    const selectedPatients = patients.filter(p => selectedIds.has(p.id));
    
    if (selectedPatients.length === 0) return;

    setShowResults(false);
    const batchResults = await generateBatchCourses(
      selectedPatients,
      autoInsert ? onUpdatePatient : undefined
    );
    
    setResults(batchResults);
    setShowResults(true);
  };

  const handleCopyAll = () => {
    const successResults = results.filter(r => r.course);
    const text = successResults
      .map(r => `## ${r.patientName}\n\n${r.course}`)
      .join('\n\n---\n\n');
    
    navigator.clipboard.writeText(text);
    toast.success('All courses copied to clipboard');
  };

  const handleCopySingle = (course: string, name: string) => {
    navigator.clipboard.writeText(course);
    toast.success(`${name}'s course copied`);
  };

  const handleUndo = () => {
    undoLastBatch(onUpdatePatient);
  };

  const handleClose = () => {
    if (!isGenerating) {
      onOpenChange(false);
    }
  };

  const progressPercent = progress.total > 0 
    ? (progress.completed / progress.total) * 100 
    : 0;

  const successCount = results.filter(r => r.course).length;
  const failCount = results.filter(r => !r.course).length;

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Batch Course Generation
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden">
          {!showResults ? (
            <div className="p-4 space-y-4">
              {/* Selection Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedIds.size} of {patientsWithContent.length} selected
                </span>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedIds.size === patientsWithContent.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Patient List */}
              <ScrollArea className="h-[300px]">
                {patientsWithContent.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No patients with data</p>
                    <p className="text-xs mt-1">Add clinical notes to patients first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {patientsWithContent.map(patient => (
                      <button
                        key={patient.id}
                        onClick={() => togglePatient(patient.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98]",
                          selectedIds.has(patient.id) 
                            ? "bg-primary/10 border border-primary/30" 
                            : "bg-muted/50 border border-transparent"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(patient.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium truncate">{patient.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Bed: {patient.bed}
                          </div>
                        </div>
                        {selectedIds.has(patient.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Auto-insert toggle */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mobile-auto-insert" className="text-sm cursor-pointer">
                      Auto-insert into Clinical Summary
                    </Label>
                    <Switch
                      id="mobile-auto-insert"
                      checked={autoInsert}
                      onCheckedChange={setAutoInsert}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Progress during generation */}
              {isGenerating && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">
                        {progress.current}
                      </span>
                      <span className="font-medium shrink-0">
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </CardContent>
                </Card>
              )}

              {/* Undo button */}
              {canUndo && !isGenerating && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleUndo}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Undo Last Batch
                </Button>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Results Summary */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {successCount} Generated
                </Badge>
                {failCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <X className="h-3 w-3" />
                    {failCount} Failed
                  </Badge>
                )}
                {autoInsert && successCount > 0 && (
                  <Badge variant="outline">Auto-inserted</Badge>
                )}
              </div>

              {/* Results List */}
              <ScrollArea className="h-[320px]">
                <div className="space-y-3">
                  {results.map(result => (
                    <Card
                      key={result.patientId}
                      className={cn(
                        result.course 
                          ? "border-l-4 border-l-green-500" 
                          : "border-l-4 border-l-destructive bg-destructive/5"
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {result.course ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-medium">{result.patientName}</span>
                          </div>
                          {result.course && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleCopySingle(result.course!, result.patientName)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {result.course ? (
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-[100px] overflow-y-auto bg-muted/50 p-2 rounded">
                            {result.course}
                          </pre>
                        ) : (
                          <p className="text-xs text-destructive">{result.error}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              {/* Result actions */}
              <div className="space-y-2">
                {successCount > 0 && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleCopyAll}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All Courses
                  </Button>
                )}
                {canUndo && autoInsert && (
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={handleUndo}
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Undo All Insertions
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
          {!showResults ? (
            <div className="flex gap-2 w-full">
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1" disabled={isGenerating}>
                  Cancel
                </Button>
              </DrawerClose>
              {isGenerating ? (
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={cancelGeneration}
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button 
                  className="flex-1"
                  onClick={handleGenerate} 
                  disabled={selectedIds.size === 0}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate ({selectedIds.size})
                </Button>
              )}
            </div>
          ) : (
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

// Trigger button component for easy integration
interface MobileBatchCourseButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const MobileBatchCourseButton = ({ onClick, disabled }: MobileBatchCourseButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full text-left active:scale-[0.98] transition-transform disabled:opacity-50"
  >
    <Card className="border-l-4 hover:bg-muted/50 transition-colors" style={{ borderLeftColor: '#8b5cf6' }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: '#8b5cf615' }}
          >
            <Users className="h-6 w-6" style={{ color: '#8b5cf6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Batch Course Generator</h3>
              <Badge variant="outline" className="text-xs">AI</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Generate courses for multiple patients
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  </button>
);
