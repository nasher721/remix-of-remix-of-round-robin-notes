import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Patient, PatientSystems } from '@/types/patient';
import { useSettings } from '@/contexts/SettingsContext';

// All dictatable fields on a patient
export type DictationField =
  | 'clinicalSummary'
  | 'intervalEvents'
  | 'labs'
  | 'imaging'
  | 'systems.neuro'
  | 'systems.cv'
  | 'systems.resp'
  | 'systems.renalGU'
  | 'systems.gi'
  | 'systems.endo'
  | 'systems.heme'
  | 'systems.infectious'
  | 'systems.skinLines'
  | 'systems.dispo';

export interface DictationFieldConfig {
  key: DictationField;
  label: string;
  shortLabel: string;
  icon: string;
  section: 'main' | 'systems';
}

export const DICTATION_FIELDS: DictationFieldConfig[] = [
  { key: 'clinicalSummary', label: 'Clinical Summary', shortLabel: 'Summary', icon: '📋', section: 'main' },
  { key: 'intervalEvents', label: 'Interval Events', shortLabel: 'Events', icon: '📅', section: 'main' },
  { key: 'labs', label: 'Labs', shortLabel: 'Labs', icon: '🧪', section: 'main' },
  { key: 'imaging', label: 'Imaging', shortLabel: 'Imaging', icon: '🩻', section: 'main' },
  { key: 'systems.neuro', label: 'Neurology', shortLabel: 'Neuro', icon: '🧠', section: 'systems' },
  { key: 'systems.cv', label: 'Cardiovascular', shortLabel: 'CV', icon: '❤️', section: 'systems' },
  { key: 'systems.resp', label: 'Respiratory', shortLabel: 'Resp', icon: '🫁', section: 'systems' },
  { key: 'systems.renalGU', label: 'Renal/GU', shortLabel: 'Renal', icon: '🫘', section: 'systems' },
  { key: 'systems.gi', label: 'GI', shortLabel: 'GI', icon: '🔄', section: 'systems' },
  { key: 'systems.endo', label: 'Endocrine', shortLabel: 'Endo', icon: '⚗️', section: 'systems' },
  { key: 'systems.heme', label: 'Hematology', shortLabel: 'Heme', icon: '🩸', section: 'systems' },
  { key: 'systems.infectious', label: 'Infectious Disease', shortLabel: 'ID', icon: '🦠', section: 'systems' },
  { key: 'systems.skinLines', label: 'Skin/Lines', shortLabel: 'Skin', icon: '🩹', section: 'systems' },
  { key: 'systems.dispo', label: 'Disposition', shortLabel: 'Dispo', icon: '🏠', section: 'systems' },
];

// Dictation mode: tap-to-toggle or hold-to-talk (PowerMic style)
export type DictationMode = 'tap' | 'hold';

// Insert mode: append to existing text or replace it
export type InsertMode = 'append' | 'replace';

interface UseMobileDictationOptions {
  patient: Patient | null;
  onFieldUpdate: (id: string, field: string, value: unknown) => void;
  enabledSystemKeys?: string[];
}

interface UseMobileDictationReturn {
  // Panel state
  isPanelOpen: boolean;
  openPanel: (field?: DictationField) => void;
  closePanel: () => void;

  // Recording state
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  interimText: string;
  pendingTranscript: string | null;
  error: string | null;

  // Field selection
  activeField: DictationField;
  setActiveField: (field: DictationField) => void;
  availableFields: DictationFieldConfig[];

  // Mode
  dictationMode: DictationMode;
  setDictationMode: (mode: DictationMode) => void;

  // Recording actions (for both tap and hold modes)
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleRecording: () => Promise<void>;

  // Insert actions
  insertTranscript: (mode: InsertMode) => void;
  discardTranscript: () => void;
}

// Apply dictation voice commands (like Dragon Medical punctuation commands)
function applyDictationCommands(text: string): string {
  return text
    .replace(/\bnew paragraph\b/gi, '\n\n')
    .replace(/\bnew line\b/gi, '\n')
    .replace(/\bperiod\b(?=\s|$)/gi, '.')
    .replace(/\bcomma\b(?=\s|$)/gi, ',')
    .replace(/\bquestion mark\b(?=\s|$)/gi, '?')
    .replace(/\bexclamation(?: point| mark)?\b(?=\s|$)/gi, '!')
    .replace(/\bcolon\b(?=\s|$)/gi, ':')
    .replace(/\bsemicolon\b(?=\s|$)/gi, ';')
    .replace(/\bopen paren(?:thesis)?\b/gi, '(')
    .replace(/\bclose paren(?:thesis)?\b/gi, ')')
    .replace(/\bdash\b(?=\s|$)/gi, '-')
    .replace(/\bhyphen\b(?=\s|$)/gi, '-')
    .replace(/\bslash\b(?=\s|$)/gi, '/')
    .replace(/\bopen bracket\b/gi, '[')
    .replace(/\bclose bracket\b/gi, ']')
    .trim();
}

// Process base64 audio in chunks (avoid memory spikes)
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    chunks.push(bytes);
    position += chunkSize;
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function useMobileDictation({
  patient,
  onFieldUpdate,
  enabledSystemKeys = [],
}: UseMobileDictationOptions): UseMobileDictationReturn {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<DictationField>('clinicalSummary');
  const [dictationMode, setDictationMode] = useState<DictationMode>('tap');

  const { toast } = useToast();
  const { getModelForFeature } = useSettings();

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Web Speech API ref (for real-time interim display)
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Compute available fields (filter systems by enabled systems)
  const availableFields = DICTATION_FIELDS.filter((f) => {
    if (f.section === 'main') return true;
    const sysKey = f.key.split('.')[1];
    return enabledSystemKeys.length === 0 || enabledSystemKeys.includes(sysKey);
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) { /* noop */ }
      }
    };
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100 * 1.5)));
        animationFrameRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (err) {
      console.warn('Audio analysis failed:', err);
    }
  }, []);

  // Start Web Speech API for live interim text
  const startInterimRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;
    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (!event.results[i].isFinal) {
            interim += event.results[i][0].transcript;
          }
        }
        if (interim) setInterimText(interim);
      };
      recognition.onerror = () => { /* silent - Whisper is authoritative */ };
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Web Speech API unavailable:', err);
    }
  }, []);

  const stopInterimRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* noop */ }
      recognitionRef.current = null;
    }
    setInterimText('');
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;
    try {
      setError(null);
      setPendingTranscript(null);
      setInterimText('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      startAudioAnalysis(stream);
      startInterimRecognition();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not access microphone';
      setError(msg);
      toast({ title: 'Microphone error', description: msg, variant: 'destructive' });
    }
  }, [isRecording, isProcessing, startAudioAnalysis, startInterimRecognition, toast]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    stopAudioAnalysis();
    stopInterimRecognition();

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve();
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });

          if (audioBlob.size < 500) {
            setIsProcessing(false);
            resolve();
            return;
          }

          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              const { data, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
                body: {
                  audio: base64,
                  mimeType: mimeType.split(';')[0],
                  enhanceMedical: true,
                  model: getModelForFeature('transcription'),
                },
              });

              if (fnError) throw new Error(fnError.message || 'Transcription failed');
              if (data?.error) throw new Error(data.error);

              const text: string = data?.text || '';
              if (text) {
                const processed = applyDictationCommands(text);
                setPendingTranscript(processed);
              } else {
                toast({ title: 'No speech detected', description: 'Speak clearly and try again', variant: 'destructive' });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Transcription failed';
              setError(msg);
              toast({ title: 'Transcription failed', description: msg, variant: 'destructive' });
            } finally {
              setIsProcessing(false);
              resolve();
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Processing error';
          setError(msg);
          setIsProcessing(false);
          resolve();
        }

        // Release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.stop();
    });
  }, [isRecording, stopAudioAnalysis, stopInterimRecognition, toast, getModelForFeature]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Get current field value from patient
  const getFieldValue = useCallback(
    (field: DictationField): string => {
      if (!patient) return '';
      if (field.startsWith('systems.')) {
        const sysKey = field.split('.')[1] as keyof PatientSystems;
        return patient.systems?.[sysKey] || '';
      }
      return (patient[field as keyof Patient] as string) || '';
    },
    [patient]
  );

  // Insert the pending transcript into the active field
  const insertTranscript = useCallback(
    (mode: InsertMode) => {
      if (!patient || !pendingTranscript) return;

      const current = getFieldValue(activeField);
      let newValue: string;

      if (mode === 'replace') {
        newValue = pendingTranscript;
      } else {
        // Append: add a space or newline separator if there's existing content
        if (current) {
          const trimmed = current.replace(/<br\s*\/?>\s*$/, '').trim();
          newValue = trimmed ? `${trimmed} ${pendingTranscript}` : pendingTranscript;
        } else {
          newValue = pendingTranscript;
        }
      }

      onFieldUpdate(patient.id, activeField, newValue);
      setPendingTranscript(null);

      toast({
        title: 'Inserted',
        description: `Text added to ${DICTATION_FIELDS.find((f) => f.key === activeField)?.label || activeField}`,
      });
    },
    [patient, pendingTranscript, activeField, getFieldValue, onFieldUpdate, toast]
  );

  const discardTranscript = useCallback(() => {
    setPendingTranscript(null);
    setInterimText('');
  }, []);

  const openPanel = useCallback((field?: DictationField) => {
    if (field) setActiveField(field);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    if (isRecording) return; // Don't close while recording
    setIsPanelOpen(false);
    setPendingTranscript(null);
    setInterimText('');
    setError(null);
  }, [isRecording]);

  return {
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
  };
}
