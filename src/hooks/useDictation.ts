import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseDictationOptions {
  onTranscript?: (text: string) => void;
  enhanceMedical?: boolean;
}

interface UseDictationReturn {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  toggleRecording: () => Promise<void>;
  transcript: string | null;
  error: string | null;
}

export const useDictation = (options: UseDictationOptions = {}): UseDictationReturn => {
  const { onTranscript, enhanceMedical = true } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      // Determine best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Speak clearly for best results",
      });
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      toast({
        title: "Microphone error",
        description: message,
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }
      
      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        
        try {
          // Create blob from chunks
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          
          if (audioBlob.size < 1000) {
            throw new Error('Recording too short. Please try again.');
          }
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              
              // Send to transcription endpoint
              const { data, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
                body: {
                  audio: base64,
                  mimeType: mimeType.split(';')[0],
                  enhanceMedical,
                },
              });
              
              if (fnError) {
                throw new Error(fnError.message || 'Transcription failed');
              }
              
              if (data?.error) {
                if (data.needsApiKey) {
                  throw new Error('Please configure OPENAI_API_KEY in your secrets for dictation.');
                }
                throw new Error(data.error);
              }
              
              const text = data?.text || '';
              setTranscript(text);
              
              if (text) {
                onTranscript?.(text);
                toast({
                  title: data.enhanced ? "Transcription enhanced" : "Transcription complete",
                  description: text.length > 50 ? text.substring(0, 50) + '...' : text,
                });
              } else {
                toast({
                  title: "No speech detected",
                  description: "Please try speaking more clearly",
                  variant: "destructive",
                });
              }
              
              resolve(text || null);
              
            } catch (err) {
              console.error('Transcription error:', err);
              const message = err instanceof Error ? err.message : 'Transcription failed';
              setError(message);
              toast({
                title: "Transcription failed",
                description: message,
                variant: "destructive",
              });
              resolve(null);
            } finally {
              setIsProcessing(false);
            }
          };
          
          reader.readAsDataURL(audioBlob);
          
        } catch (err) {
          console.error('Processing error:', err);
          const message = err instanceof Error ? err.message : 'Processing failed';
          setError(message);
          setIsProcessing(false);
          toast({
            title: "Processing failed",
            description: message,
            variant: "destructive",
          });
          resolve(null);
        }
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorder.stop();
    });
  }, [enhanceMedical, onTranscript, toast]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    toggleRecording,
    transcript,
    error,
  };
};
