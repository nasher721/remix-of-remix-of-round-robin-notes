import { pipeline, env } from '@xenova/transformers';

// Disable local models, we will fetch from HF hub
env.allowLocalModels = false;
// Use the ONNX WASM backend
env.backends.onnx.wasm.numThreads = 1;

type TranscribeOptions = {
    chunk_length_s: number;
    stride_length_s: number;
    language: string;
    task: 'transcribe';
};

type TranscriberResult = { text: string };

type Transcriber = (
    audio: Float32Array,
    options: TranscribeOptions,
) => Promise<TranscriberResult>;

type WorkerIncomingMessage =
    | { type: 'load' }
    | { type: 'transcribe'; audio: Float32Array };

type PipelineProgress = {
    status?: string;
    progress?: number;
};

let transcriber: Transcriber | null = null;

// Messages from the main thread
self.addEventListener('message', async (event: MessageEvent<WorkerIncomingMessage>) => {
    const { type } = event.data;

    if (type === 'load') {
        try {
            if (!transcriber) {
                // Post progress updates back to the main thread
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                    progress_callback: (info: PipelineProgress) => {
                        self.postMessage({ type: 'progress', info });
                    },
                }) as Transcriber;
            }
            self.postMessage({ type: 'ready' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            self.postMessage({ type: 'error', error: message });
        }
    }

    if (type === 'transcribe') {
        try {
            if (!transcriber) {
                throw new Error('Transcriber not loaded yet');
            }

            const result = await transcriber(event.data.audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: 'english',
                task: 'transcribe',
            });
            self.postMessage({ type: 'result', text: result.text });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            self.postMessage({ type: 'error', error: message });
        }
    }
});
