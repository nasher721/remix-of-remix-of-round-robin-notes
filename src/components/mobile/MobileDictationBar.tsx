/**
 * MobileDictationBar — Dragon Medical One Mobile PowerMic-style dictation interface
 *
 * A floating dictation panel for iPhone-optimized clinical documentation.
 * Supports push-to-talk (hold) and tap-to-toggle modes with Whisper AI transcription
 * and real-time interim text via Web Speech API.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Mic,
  MicOff,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Info,
} from 'lucide-react';
import {
  useMobileDictation,
  DictationField,
  DICTATION_FIELDS,
  DictationMode,
  InsertMode,
} from '@/hooks/useMobileDictation';
import { Patient } from '@/types/patient';

// ─── Audio Waveform ────────────────────────────────────────────────────────────

interface WaveformProps {
  level: number;
  isActive: boolean;
}

function AudioWaveform({ level, isActive }: WaveformProps) {
  const BAR_COUNT = 9;
  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const center = Math.floor(BAR_COUNT / 2);
        const distFromCenter = Math.abs(i - center);
        const baseHeight = isActive ? Math.max(4, level * 0.28) : 4;
        // Bars further from center are shorter (natural waveform shape)
        const multiplier = 1 - distFromCenter * 0.08;
        // Add random-ish variation when active
        const variation = isActive ? Math.sin((Date.now() / 200 + i) * 0.8) * level * 0.1 : 0;
        const height = Math.max(4, Math.min(32, baseHeight * multiplier + variation));

        return (
          <div
            key={i}
            className={cn(
              'w-1 rounded-full transition-all',
              isActive ? 'bg-red-500 duration-75' : 'bg-muted-foreground/40 duration-300'
            )}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}

// ─── Field Selector Tab Strip ──────────────────────────────────────────────────

interface FieldSelectorProps {
  activeField: DictationField;
  onSelect: (field: DictationField) => void;
  fields: typeof DICTATION_FIELDS;
  disabled?: boolean;
}

function FieldSelector({ activeField, onSelect, fields, disabled }: FieldSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view on mount / field change
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeField]);

  const mainFields = fields.filter((f) => f.section === 'main');
  const sysFields = fields.filter((f) => f.section === 'systems');

  return (
    <div className="space-y-1.5">
      {/* Main fields */}
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {mainFields.map((f) => (
          <button
            key={f.key}
            data-active={activeField === f.key}
            onClick={() => !disabled && onSelect(f.key)}
            disabled={disabled}
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
              activeField === f.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 active:scale-95'
            )}
          >
            <span>{f.icon}</span>
            <span>{f.shortLabel}</span>
          </button>
        ))}
      </div>
      {/* System fields (scrollable) */}
      {sysFields.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {sysFields.map((f) => (
            <button
              key={f.key}
              data-active={activeField === f.key}
              onClick={() => !disabled && onSelect(f.key)}
              disabled={disabled}
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                activeField === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 active:scale-95'
              )}
            >
              <span>{f.icon}</span>
              <span>{f.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── The large PowerMic-style Record Button ────────────────────────────────────

interface RecordButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  dictationMode: DictationMode;
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  disabled?: boolean;
}

function RecordButton({
  isRecording,
  isProcessing,
  dictationMode,
  onTap,
  onHoldStart,
  onHoldEnd,
  disabled,
}: RecordButtonProps) {
  const holdActiveRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (disabled || isProcessing) return;
      if (dictationMode === 'hold') {
        holdActiveRef.current = true;
        onHoldStart();
      }
    },
    [disabled, isProcessing, dictationMode, onHoldStart]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (disabled || isProcessing) return;
      if (dictationMode === 'hold' && holdActiveRef.current) {
        holdActiveRef.current = false;
        onHoldEnd();
      } else if (dictationMode === 'tap') {
        onTap();
      }
    },
    [disabled, isProcessing, dictationMode, onTap, onHoldEnd]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (dictationMode === 'hold' && holdActiveRef.current) {
        holdActiveRef.current = false;
        onHoldEnd();
      }
    },
    [dictationMode, onHoldEnd]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* The big button */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        disabled={disabled}
        style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        className={cn(
          'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-150',
          'shadow-lg active:shadow-sm focus:outline-none select-none',
          isProcessing
            ? 'bg-muted text-muted-foreground cursor-wait'
            : isRecording
            ? 'bg-red-500 text-white shadow-red-500/50 scale-105 active:scale-100'
            : 'bg-primary text-primary-foreground active:scale-95 hover:bg-primary/90',
          isRecording && 'animate-pulse-glow',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-label={
          isProcessing ? 'Processing...' : isRecording ? 'Stop recording' : dictationMode === 'hold' ? 'Hold to dictate' : 'Tap to dictate'
        }
      >
        {isProcessing ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-10 w-10" />
        ) : (
          <Mic className="h-10 w-10" />
        )}
      </button>

      {/* Label below button */}
      <span className="text-xs font-medium text-muted-foreground">
        {isProcessing
          ? 'Transcribing...'
          : isRecording
          ? dictationMode === 'hold'
            ? 'Release to send'
            : 'Tap to stop'
          : dictationMode === 'hold'
          ? 'Hold to speak'
          : 'Tap to speak'}
      </span>
    </div>
  );
}

// ─── Transcript Review Area ────────────────────────────────────────────────────

interface TranscriptAreaProps {
  interimText: string;
  pendingTranscript: string | null;
  isRecording: boolean;
  isProcessing: boolean;
  onInsert: (mode: InsertMode) => void;
  onDiscard: () => void;
}

function TranscriptArea({
  interimText,
  pendingTranscript,
  isRecording,
  isProcessing,
  onInsert,
  onDiscard,
}: TranscriptAreaProps) {
  const displayText = pendingTranscript || (isRecording ? interimText : '');
  const isPending = !!pendingTranscript;

  if (!displayText && !isRecording && !isProcessing) {
    return (
      <div className="flex items-center justify-center py-4 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
          Your transcription will appear here. Medical terminology is automatically enhanced.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Transcript text box */}
      <div
        className={cn(
          'min-h-[80px] max-h-[140px] overflow-y-auto rounded-xl p-3 text-sm leading-relaxed',
          isPending
            ? 'bg-primary/5 border border-primary/20 text-foreground'
            : 'bg-muted/60 text-muted-foreground italic'
        )}
      >
        {isProcessing ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            <span className="text-xs">Transcribing with medical AI...</span>
          </div>
        ) : (
          <span>{displayText || '\u00A0'}</span>
        )}
      </div>

      {/* Action buttons for pending transcript */}
      {isPending && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onDiscard}
            className="flex-1 h-9 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Discard
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onInsert('replace')}
            className="flex-1 h-9 text-xs gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Replace
          </Button>
          <Button
            size="sm"
            onClick={() => onInsert('append')}
            className="flex-1 h-9 text-xs gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Append
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Mode Toggle ───────────────────────────────────────────────────────────────

interface ModeSwitchProps {
  mode: DictationMode;
  onChange: (mode: DictationMode) => void;
  disabled?: boolean;
}

function ModeSwitch({ mode, onChange, disabled }: ModeSwitchProps) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
      <button
        onClick={() => !disabled && onChange('tap')}
        className={cn(
          'flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all',
          mode === 'tap'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        disabled={disabled}
      >
        Tap
      </button>
      <button
        onClick={() => !disabled && onChange('hold')}
        className={cn(
          'flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all',
          mode === 'hold'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        disabled={disabled}
      >
        Hold
      </button>
    </div>
  );
}

// ─── Floating FAB (collapsed state) ───────────────────────────────────────────

interface FloatingFABProps {
  onClick: () => void;
  isRecording?: boolean;
}

function FloatingFAB({ onClick, isRecording }: FloatingFABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center',
        'transition-all duration-200 active:scale-90 focus:outline-none',
        isRecording
          ? 'bg-red-500 text-white animate-pulse shadow-red-500/40 shadow-xl'
          : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/30'
      )}
      aria-label="Open dictation panel"
    >
      <Mic className="h-6 w-6" />
    </button>
  );
}

// ─── Main MobileDictationBar ───────────────────────────────────────────────────

export interface MobileDictationBarProps {
  patient: Patient | null;
  onFieldUpdate: (id: string, field: string, value: unknown) => void;
  enabledSystemKeys?: string[];
  defaultField?: DictationField;
  className?: string;
}

export function MobileDictationBar({
  patient,
  onFieldUpdate,
  enabledSystemKeys = [],
  defaultField,
  className,
}: MobileDictationBarProps) {
  const [showVoiceCommandHelp, setShowVoiceCommandHelp] = useState(false);

  const {
    isPanelOpen,
    openPanel,
    closePanel,
    isRecording,
    isProcessing,
    audioLevel,
    interimText,
    pendingTranscript,
    error,
    activeField,
    setActiveField,
    availableFields,
    dictationMode,
    setDictationMode,
    startRecording,
    stopRecording,
    toggleRecording,
    insertTranscript,
    discardTranscript,
  } = useMobileDictation({
    patient,
    onFieldUpdate,
    enabledSystemKeys,
  });

  // Open with default field if provided
  const handleFABClick = useCallback(() => {
    openPanel(defaultField);
  }, [openPanel, defaultField]);

  const handleHoldStart = useCallback(async () => {
    await startRecording();
  }, [startRecording]);

  const handleHoldEnd = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  const handleTap = useCallback(async () => {
    await toggleRecording();
  }, [toggleRecording]);

  if (!patient) return null;

  const activeFieldConfig = DICTATION_FIELDS.find((f) => f.key === activeField);

  return (
    <>
      {/* Floating action button (always visible when panel is closed) */}
      {!isPanelOpen && (
        <FloatingFAB onClick={handleFABClick} isRecording={isRecording} />
      )}

      {/* Bottom sheet panel */}
      {isPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={isRecording ? undefined : closePanel}
          />

          {/* Panel */}
          <div
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl',
              'border-t border-border/60 safe-area-inset-bottom',
              'transition-transform duration-300',
              className
            )}
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
              maxHeight: '85dvh',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    isRecording ? 'bg-red-500 animate-pulse' : isProcessing ? 'bg-amber-500' : 'bg-muted-foreground/40'
                  )}
                />
                <span className="font-semibold text-sm">Voice Dictation</span>
                {activeFieldConfig && (
                  <span className="text-xs text-muted-foreground">
                    → {activeFieldConfig.icon} {activeFieldConfig.shortLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowVoiceCommandHelp((v) => !v)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Voice command help"
                >
                  <Info className="h-4 w-4" />
                </button>
                <button
                  onClick={closePanel}
                  disabled={isRecording}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
                  aria-label="Close dictation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Voice command help */}
            {showVoiceCommandHelp && (
              <div className="mx-4 mb-2 p-3 rounded-xl bg-muted/50 border border-border/40 text-xs space-y-1.5">
                <p className="font-semibold text-foreground mb-2">Voice Commands</p>
                {[
                  ['"New paragraph"', '→ blank line'],
                  ['"New line"', '→ line break'],
                  ['"Period"', '→ .'],
                  ['"Comma"', '→ ,'],
                  ['"Question mark"', '→ ?'],
                  ['"Colon"', '→ :'],
                  ['"Open paren"', '→ ('],
                  ['"Close paren"', '→ )'],
                ].map(([cmd, result]) => (
                  <div key={cmd} className="flex justify-between text-muted-foreground">
                    <span className="font-mono bg-background px-1 rounded">{cmd}</span>
                    <span>{result}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 pb-2 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 80px)' }}>
              {/* Field selector */}
              <FieldSelector
                activeField={activeField}
                onSelect={setActiveField}
                fields={availableFields}
                disabled={isRecording || isProcessing}
              />

              {/* Divider */}
              <div className="border-t border-border/40" />

              {/* Mode switch + patient name */}
              <div className="flex items-center gap-3">
                <ModeSwitch
                  mode={dictationMode}
                  onChange={setDictationMode}
                  disabled={isRecording || isProcessing}
                />
                <span className="text-xs text-muted-foreground truncate flex-1 text-right">
                  {patient.name} · Bed {patient.bed}
                </span>
              </div>

              {/* Center: Waveform + big button */}
              <div className="flex flex-col items-center gap-3 py-2">
                <AudioWaveform level={audioLevel} isActive={isRecording} />
                <RecordButton
                  isRecording={isRecording}
                  isProcessing={isProcessing}
                  dictationMode={dictationMode}
                  onTap={handleTap}
                  onHoldStart={handleHoldStart}
                  onHoldEnd={handleHoldEnd}
                  disabled={!patient}
                />
              </div>

              {/* Transcript area */}
              <TranscriptArea
                interimText={interimText}
                pendingTranscript={pendingTranscript}
                isRecording={isRecording}
                isProcessing={isProcessing}
                onInsert={insertTranscript}
                onDiscard={discardTranscript}
              />

              {/* Error display */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Tip */}
              <p className="text-center text-[10px] text-muted-foreground/60 pb-1">
                Powered by Whisper AI with medical terminology enhancement
              </p>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(239, 68, 68, 0);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
