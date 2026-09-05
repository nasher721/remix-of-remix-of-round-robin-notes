import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CaptureController, type CaptureBinding } from '../captureController';

const binding: CaptureBinding = { sessionId: 's1', roundId: 'r1', patientId: 'p1', physicianId: 'd1', deviceId: 'device', patientSnapshotId: 'snap', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };

describe('CaptureController', () => {
  it('requires explicit start and locks the patient through review', async () => {
    const controller = new CaptureController({ timeoutMs: 60_000 });
    assert.equal(controller.getState().lifecycle, 'idle');
    await controller.start(binding);
    assert.equal(controller.getState().lifecycle, 'capturing');
    controller.invalidateIfPatientChanged('p2');
    assert.equal(controller.getState().lifecycle, 'invalidated');
    assert.equal(controller.getEncryptedBuffer().length, 0);
  });
  it('encrypts only bounded in-memory audio and erases it on terminal paths', async () => {
    const controller = new CaptureController({ maxBufferBytes: 31, timeoutMs: 60_000 });
    await controller.start(binding);
    assert.equal(await controller.appendAudio(new Uint8Array([1, 2, 3])), true);
    assert.equal(controller.getEncryptedBuffer().length, 1);
    assert.equal(await controller.appendAudio(new Uint8Array([4])), false);
    assert.equal(controller.getState().lifecycle, 'failed');
    assert.equal(controller.getEncryptedBuffer().length, 0);
  });
  it('discards on interruption, offline, crash recovery, and explicit discard', async () => {
    for (const action of [
      (c: CaptureController) => c.handleInterruption(),
      (c: CaptureController) => c.handleOffline(),
      (c: CaptureController) => c.recoverAfterCrash(),
      (c: CaptureController) => c.discard(),
    ]) {
      const controller = new CaptureController({ timeoutMs: 60_000 });
      await controller.start(binding); action(controller);
      assert.ok(['invalidated', 'discarded'].includes(controller.getState().lifecycle));
      assert.equal(controller.getEncryptedBuffer().length, 0);
    }
  });
  it('supports pause/resume and stop to compact review without exposing transcript', async () => {
    const controller = new CaptureController({ timeoutMs: 60_000 }); await controller.start(binding);
    controller.pause(); assert.equal(controller.getState().lifecycle, 'paused'); controller.resume();
    assert.equal(controller.stop().lifecycle, 'review'); await assert.rejects(() => controller.appendAudio(new Uint8Array([1])));
  });
  it('erases the ephemeral buffer at attestation', async () => {
    const controller = new CaptureController({ timeoutMs: 60_000 }); await controller.start(binding);
    await controller.appendAudio(new Uint8Array([1])); controller.stop(); controller.attest();
    assert.equal(controller.getState().lifecycle, 'attested'); assert.equal(controller.getEncryptedBuffer().length, 0);
  });
});
