import { pipeline, env } from '@xenova/transformers';

// Disable local models, we will fetch from HF hub
env.allowLocalModels = false;
// Use the ONNX WASM backend
env.backends.onnx.wasm.numThreads = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;

// Messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, audio } = event.data;

    if (type === 'load') {
        try {
            if (!transcriber) {
                // Post progress updates back to the main thread
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    progress_callback: (info: any) => {
                        self.postMessage({ type: 'progress', info });
                    }
                });
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
                throw new Error("Transcriber not loaded yet");
            }
            const result = await transcriber(audio, {
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
