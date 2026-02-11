import { useState, useRef, useCallback, useEffect } from 'react';
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
  audioStream: MediaStream | null;
  audioLevel: number; // 0-100 representing volume level
}

export const useDictation = (options: UseDictationOptions = {}): UseDictationReturn => {
  const { onTranscript, enhanceMedical = true } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Cleanup function for audio analysis
  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Start audio level analysis
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
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Normalize to 0-100 range with some amplification for better visual feedback
        const normalizedLevel = Math.min(100, Math.round((average / 128) * 100 * 1.5));
        setAudioLevel(normalizedLevel);
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (err) {
      console.error('Failed to start audio analysis:', err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]);

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
      setAudioStream(stream);
      chunksRef.current = [];
      
      // Start audio level analysis
      startAudioAnalysis(stream);
      
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
  }, [toast, startAudioAnalysis]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      // Stop audio analysis first
      stopAudioAnalysis();
      
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
          setAudioStream(null);
        }
      };
      
      mediaRecorder.stop();
    });
  }, [enhanceMedical, onTranscript, toast, stopAudioAnalysis]);

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
    audioStream,
    audioLevel,
  };
};
