import React, { useEffect } from 'react';
import { useLocalDictation } from '@/hooks/useLocalDictation';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, DownloadCloud } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LocalDictationButtonProps {
    onTranscriptionComplete: (text: string) => void;
    className?: string;
}

export function LocalDictationButton({ onTranscriptionComplete, className }: LocalDictationButtonProps) {
    const {
        isReady,
        isModelLoading,
        isRecording,
        isTranscribing,
        progress,
        text,
        error,
        loadModel,
        startRecording,
        stopRecording,
        clearText
    } = useLocalDictation();

    // Bubble up transcription text when it becomes available
    useEffect(() => {
        if (text) {
            onTranscriptionComplete(text);
            clearText(); // Clear it out after firing so it doesn't double-fire
        }
    }, [text, onTranscriptionComplete, clearText]);

    if (error) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" className={className} disabled>
                            <Mic className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-destructive text-destructive-foreground">
                        <p>Error: {error}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (isModelLoading) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className={`relative ${className}`} disabled>
                            <DownloadCloud className="h-4 w-4 text-indigo-400 animate-pulse" />
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Downloading Whisper Model ({progress}%)...</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (!isReady) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={className}
                            onClick={() => loadModel()}
                        >
                            <Mic className="h-4 w-4 text-neutral-400" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Load Offline Dictation (40MB)</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (isTranscribing) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className={className} disabled>
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Transcribing locally...</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (isRecording) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className={`animate-pulse ${className}`}
                            onClick={() => stopRecording()}
                        >
                            <Square className="h-4 w-4 fill-current" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Stop Recording</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Default state: Ready to record
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={`hover:text-indigo-400 hover:border-indigo-400/50 ${className}`}
                        onClick={() => startRecording()}
                    >
                        <Mic className="h-4 w-4 text-indigo-400" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Start Offline Dictation</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
