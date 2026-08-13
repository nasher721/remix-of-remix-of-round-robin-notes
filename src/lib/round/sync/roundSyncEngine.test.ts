import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roundSyncEngine } from "./roundSyncEngine";

describe("roundSyncEngine deriveChromeStatus", () => {
  it("returns offline when disconnected", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: false,
        pendingCount: 0,
        conflictCount: 0,
        failedCount: 0,
        softFailedCount: 0,
      }),
      "offline",
    );
  });

  it("returns conflict when conflict rows are present", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 0,
        conflictCount: 2,
        failedCount: 0,
        softFailedCount: 0,
      }),
      "conflict",
    );
  });

  it("returns failed over syncing and pending", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 3,
        conflictCount: 0,
        failedCount: 2,
        softFailedCount: 0,
      }),
      "failed",
    );
  });

  it("returns syncing for active queue when no failures", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 3,
        conflictCount: 0,
        failedCount: 0,
        softFailedCount: 0,
      }),
      "syncing",
    );
  });

  it("returns failed when a soft-failed write needs attention", () => {
    assert.equal(
      roundSyncEngine.deriveChromeStatus({
        isOnline: true,
        pendingCount: 1,
        conflictCount: 0,
        failedCount: 0,
        softFailedCount: 1,
      }),
      "failed",
    );
  });
});
