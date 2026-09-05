import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CaptureControl } from '../CaptureControl';
import { CaptureController, type CaptureBinding } from '@/lib/decision-scribe/captureController';

const binding: CaptureBinding = { sessionId: 's1', roundId: 'r1', patientId: 'p1', physicianId: 'd1', deviceId: 'device', patientSnapshotId: 'snap', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
afterEach(() => cleanup());

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  class TestRecorder {
    state = 'inactive'; mimeType = 'audio/webm'; ondataavailable?: (event: { data: Blob }) => void; onstop?: () => void;
    constructor(public stream: unknown) {}
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.onstop?.(); }
  }
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: TestRecorder });
});

describe('CaptureControl', () => {
  it('exposes explicit accessible start, stop, pause, and discard controls', async () => {
    const controller = new CaptureController({ timeoutMs: 60_000 }); render(<CaptureControl binding={binding} controller={controller} />);
    assert.ok(screen.getByRole('button', { name: 'Start capture' })); fireEvent.click(screen.getByRole('button', { name: 'Start capture' }));
    assert.ok(await screen.findByRole('button', { name: 'Stop and review' })); assert.ok(screen.getByRole('button', { name: 'Pause' })); assert.equal(screen.queryByText(/transcript/i), null);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' })); assert.ok(await screen.findByText(/discarded/i));
  });
});
