import { useState, useEffect, useRef, useCallback } from 'react';

export interface LocalDictationState {
    isReady: boolean;
    isModelLoading: boolean;
    isRecording: boolean;
    isTranscribing: boolean;
    progress: number;
    text: string;
    error: string | null;
}

export function useLocalDictation() {
    const [state, setState] = useState<LocalDictationState>({
        isReady: false,
        isModelLoading: false,
        isRecording: false,
        isTranscribing: false,
        progress: 0,
        text: '',
        error: null,
    });

    const workerRef = useRef<Worker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        // Initialize Web Worker
        workerRef.current = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), {
            type: 'module',
        });

        workerRef.current.onmessage = (e) => {
            const { type, info, text, error } = e.data;

            if (type === 'progress') {
                if (info.status === 'progress') {
                    setState((prev) => ({ ...prev, isModelLoading: true, progress: Math.round(info.progress || 0) }));
                } else if (info.status === 'ready') {
                    setState((prev) => ({ ...prev, progress: 100, isModelLoading: false, isReady: true }));
                }
            } else if (type === 'ready') {
                setState((prev) => ({ ...prev, isReady: true, isModelLoading: false, progress: 100 }));
            } else if (type === 'result') {
                setState((prev) => ({
                    ...prev,
                    text: prev.text ? prev.text + ' ' + text.trim() : text.trim(),
                    isTranscribing: false
                }));
            } else if (type === 'error') {
                setState((prev) => ({ ...prev, error, isModelLoading: false, isTranscribing: false }));
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const loadModel = useCallback(() => {
        if (state.isReady || state.isModelLoading) return;
        setState((prev) => ({ ...prev, isModelLoading: true, error: null, progress: 1 }));
        workerRef.current?.postMessage({ type: 'load' });
    }, [state.isReady, state.isModelLoading]);

    const startRecording = useCallback(async () => {
        if (!state.isReady) {
            loadModel();
            // wait a moment or fail early, but let's let loadModel kick off
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                setState(prev => ({ ...prev, isTranscribing: true, isRecording: false }));
                try {
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const audioData = audioBuffer.getChannelData(0); // Whisper expects 16kHz Float32Array

                    workerRef.current?.postMessage({ type: 'transcribe', audio: audioData });
                } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : 'Unknown error';
                    setState(prev => ({ ...prev, error: "Audio processing failed: " + message, isTranscribing: false }));
                }

                // Release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setState((prev) => ({ ...prev, isRecording: true, error: null }));
        } catch (err: unknown) {
            setState((prev) => ({ ...prev, error: 'Microphone access denied.' }));
        }
    }, [state.isReady, loadModel]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && state.isRecording) {
            mediaRecorderRef.current.stop();
        }
    }, [state.isRecording]);

    const clearText = useCallback(() => {
        setState((prev) => ({ ...prev, text: '' }));
    }, []);

    return {
        ...state,
        loadModel,
        startRecording,
        stopRecording,
        clearText,
    };
}
