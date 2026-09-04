import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { roundOutbox } from "@/lib/round/sync/roundOutbox";
import type { RoundOutboxEntry } from "@/lib/round/sync/types";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

afterEach(async () => {
  roundOutbox.setOwner(null);
  await roundOutbox.clear();
});

describe("roundOutbox owner boundary", () => {
  it("rejects an explicit stale owner after the active owner changes", async () => {
    roundOutbox.setOwner("user-b");

    await assert.rejects(
      () => roundOutbox.enqueueRoundState({
        roundId: "round-user-a",
        payload: {},
        updatedAt: "2026-08-13T00:00:00.000Z",
        deviceId: "device-a",
        ownerId: "user-a",
      }),
      /authenticated owner changed/,
    );
    assert.deepEqual(await roundOutbox.getQueue(), []);
  });

  it("does not publish an older queue snapshot after a newer notification", async () => {
    roundOutbox.setOwner("user-a");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const olderRead = deferred<RoundOutboxEntry[]>();
    const newerRead = deferred<RoundOutboxEntry[]>();
    const latestEntry: RoundOutboxEntry = {
      id: "latest-entry",
      ownerId: "user-a",
      kind: "round_state",
      entityKey: "round-a",
      payload: {},
      baseUpdatedAt: null,
      updatedAt: "2026-08-13T00:00:00.000Z",
      deviceId: "device-a",
      retryCount: 0,
      maxRetries: 5,
      status: "pending",
      timestamp: 2,
    };
    const originalGetQueue = roundOutbox.getQueue.bind(roundOutbox);
    let readCount = 0;
    roundOutbox.getQueue = () => (
      readCount++ === 0 ? olderRead.promise : newerRead.promise
    );

    const snapshots: string[][] = [];
    const unsubscribe = roundOutbox.subscribe((queue) => {
      snapshots.push(queue.map((entry) => entry.id));
    });

    try {
      roundOutbox.setOwner("user-a");
      newerRead.resolve([latestEntry]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      olderRead.resolve([]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.deepEqual(snapshots, [["latest-entry"]]);
    } finally {
      unsubscribe();
      roundOutbox.getQueue = originalGetQueue;
    }
  });

  it("initializes concurrent subscribers without invalidating either snapshot", async () => {
    roundOutbox.setOwner("user-a");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const firstRead = deferred<RoundOutboxEntry[]>();
    const secondRead = deferred<RoundOutboxEntry[]>();
    const originalGetQueue = roundOutbox.getQueue.bind(roundOutbox);
    let readCount = 0;
    roundOutbox.getQueue = () => (
      readCount++ === 0 ? firstRead.promise : secondRead.promise
    );

    const firstSnapshots: string[][] = [];
    const secondSnapshots: string[][] = [];
    const unsubscribeFirst = roundOutbox.subscribe((queue) => {
      firstSnapshots.push(queue.map((entry) => entry.id));
    });
    const unsubscribeSecond = roundOutbox.subscribe((queue) => {
      secondSnapshots.push(queue.map((entry) => entry.id));
    });

    try {
      secondRead.resolve([]);
      firstRead.resolve([]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.deepEqual(firstSnapshots, [[]]);
      assert.deepEqual(secondSnapshots, [[]]);
    } finally {
      unsubscribeFirst();
      unsubscribeSecond();
      roundOutbox.getQueue = originalGetQueue;
    }
  });

  it("makes a soft-failed write available to manual retry", async () => {
    roundOutbox.setOwner("user-a");
    const id = await roundOutbox.enqueueRoundState({
      roundId: "round-user-a",
      payload: {},
      updatedAt: "2026-08-13T00:00:00.000Z",
      deviceId: "device-a",
    });
    await roundOutbox.markSoftFail(id, "missing_table");

    assert.equal(await roundOutbox.getSoftFailedCount(), 1);
    assert.equal(await roundOutbox.retryFailedWrites(), 1);
    assert.equal((await roundOutbox.getQueue())[0]?.status, "pending");
    assert.equal(await roundOutbox.getSoftFailedCount(), 0);
  });
});
