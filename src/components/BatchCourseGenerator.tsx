import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Loader2,
  Check,
  X,
  Undo2,
  Users,
  FileText,
  Copy,
  AlertCircle,
  Calendar,
  ClipboardList,
} from 'lucide-react';
import { useBatchCourseGenerator, BatchResult, BatchGenerationType } from '@/hooks/useBatchCourseGenerator';
import type { Patient } from '@/types/patient';
import { cn } from '@/lib/utils';

interface BatchCourseGeneratorProps {
  patients: Patient[];
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  className?: string;
}

export const BatchCourseGenerator = ({
  patients,
  onUpdatePatient,
  className = '',
}: BatchCourseGeneratorProps) => {
  const {
    generateBatch,
    isGenerating,
    progress,
    cancelGeneration,
    undoLastBatch,
    canUndo,
  } = useBatchCourseGenerator();

  const [open, setOpen] = React.useState(false);
  const [generationType, setGenerationType] = React.useState<BatchGenerationType>('course');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [autoInsert, setAutoInsert] = React.useState(true);
  const [results, setResults] = React.useState<BatchResult[]>([]);
  const [showResults, setShowResults] = React.useState(false);

  // Filter patients based on generation type
  const patientsWithContent = React.useMemo(() => {
    return patients.filter(patient => {
      if (generationType === 'intervalEvents') {
        return Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
      } else {
        const hasContent = 
          patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
          patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
          patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
          patient.labs?.replace(/<[^>]*>/g, '').trim() ||
          Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
        return hasContent;
      }
    });
  }, [patients, generationType]);

  // Reset selection when type changes
  React.useEffect(() => {
    if (open && patientsWithContent.length > 0) {
      setSelectedIds(new Set(patientsWithContent.map(p => p.id)));
    }
  }, [open, patientsWithContent]);

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
    const batchResults = await generateBatch(
      selectedPatients,
      generationType,
      autoInsert ? onUpdatePatient : undefined
    );
    
    setResults(batchResults);
    setShowResults(true);
  };

  const handleCopyAll = () => {
    const successResults = results.filter(r => r.content);
    const text = successResults
      .map(r => `## ${r.patientName}\n\n${r.content}`)
      .join('\n\n---\n\n');
    
    navigator.clipboard.writeText(text);
  };

  const handleCopySingle = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleUndo = () => {
    undoLastBatch(onUpdatePatient);
  };

  const handleClose = () => {
    if (!isGenerating) {
      setOpen(false);
      setShowResults(false);
      setResults([]);
    }
  };

  const progressPercent = progress.total > 0 
    ? (progress.completed / progress.total) * 100 
    : 0;

  const successCount = results.filter(r => r.content).length;
  const failCount = results.filter(r => !r.content).length;

  const typeLabel = generationType === 'intervalEvents' ? 'Interval Events' : 'Courses';
  const typeLabelSingular = generationType === 'intervalEvents' ? 'Interval Event' : 'Course';

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            disabled={patients.length === 0}
          >
            <Users className="h-4 w-4 mr-2" />
            Batch AI Generate
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Batch AI Generation
            </DialogTitle>
            <DialogDescription>
              Generate content for multiple patients at once using AI.
            </DialogDescription>
          </DialogHeader>

          {!showResults ? (
            <>
              {/* Generation Type Tabs */}
              <Tabs 
                value={generationType} 
                onValueChange={(v) => setGenerationType(v as BatchGenerationType)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="course" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    Hospital Course
                  </TabsTrigger>
                  <TabsTrigger value="intervalEvents" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Interval Events
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Patient Selection */}
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Select Patients ({selectedIds.size}/{patientsWithContent.length})
                  </Label>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedIds.size === patientsWithContent.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <ScrollArea className="flex-1 max-h-[250px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {patientsWithContent.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No patients with {generationType === 'intervalEvents' ? 'system notes' : 'clinical data'} found.</p>
                        <p className="text-xs mt-1">
                          {generationType === 'intervalEvents' 
                            ? 'Add system review notes to patients first.'
                            : 'Add clinical notes to patients first.'}
                        </p>
                      </div>
                    ) : (
                      patientsWithContent.map(patient => (
                        <label
                          key={patient.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                            selectedIds.has(patient.id) 
                              ? "bg-primary/10" 
                              : "hover:bg-muted"
                          )}
                        >
                          <Checkbox
                            checked={selectedIds.has(patient.id)}
                            onCheckedChange={() => togglePatient(patient.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{patient.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Bed: {patient.bed}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Options */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-insert"
                      checked={autoInsert}
                      onCheckedChange={setAutoInsert}
                    />
                    <Label htmlFor="auto-insert" className="text-sm cursor-pointer">
                      Auto-insert into {generationType === 'intervalEvents' ? 'Interval Events' : 'Clinical Summary'}
                    </Label>
                  </div>
                  {canUndo && (
                    <Button variant="ghost" size="sm" onClick={handleUndo}>
                      <Undo2 className="h-4 w-4 mr-1" />
                      Undo Last
                    </Button>
                  )}
                </div>

                {/* Progress during generation */}
                {isGenerating && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Generating: {progress.current}
                      </span>
                      <span className="font-medium">
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
                  Cancel
                </Button>
                {isGenerating ? (
                  <Button variant="destructive" onClick={cancelGeneration}>
                    <X className="h-4 w-4 mr-2" />
                    Stop Generation
                  </Button>
                ) : (
                  <Button 
                    onClick={handleGenerate} 
                    disabled={selectedIds.size === 0}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {selectedIds.size} {selectedIds.size !== 1 ? typeLabel : typeLabelSingular}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Results View */}
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                <div className="flex items-center gap-2">
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

                <ScrollArea className="flex-1 max-h-[400px] border rounded-lg">
                  <div className="p-3 space-y-4">
                    {results.map(result => (
                      <div
                        key={result.patientId}
                        className={cn(
                          "p-3 rounded-lg border",
                          result.content ? "bg-muted/30" : "bg-destructive/10 border-destructive/30"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {result.content ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-medium">{result.patientName}</span>
                          </div>
                          {result.content && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopySingle(result.content!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {result.content ? (
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-[150px] overflow-y-auto">
                            {result.content}
                          </pre>
                        ) : (
                          <p className="text-xs text-destructive">{result.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <DialogFooter className="gap-2">
                {canUndo && autoInsert && (
                  <Button variant="outline" onClick={handleUndo}>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Undo All
                  </Button>
                )}
                {successCount > 0 && (
                  <Button variant="secondary" onClick={handleCopyAll}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                )}
                <Button onClick={handleClose}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
