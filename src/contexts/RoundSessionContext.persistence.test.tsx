import * as React from "react";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  RoundSessionProvider,
  type RoundSessionContextValue,
  useRoundSession,
} from "@/contexts/RoundSessionContext";
import { createContinuityMeta, roundSyncEngine } from "@/lib/round/sync";
import { roundOutbox } from "@/lib/round/sync/roundOutbox";
import type { Round } from "@/types/round";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

let latestSession: RoundSessionContextValue | null = null;

const SessionProbe = () => {
  latestSession = useRoundSession();
  return <span>{latestSession.round.userId}</span>;
};

const originalBindOwner = roundSyncEngine.bindOwner.bind(roundSyncEngine);
const originalEnsureNetworkListeners = roundSyncEngine.ensureNetworkListeners.bind(roundSyncEngine);
const originalHydrate = roundSyncEngine.hydrateRoundSession.bind(roundSyncEngine);
const originalPersist = roundSyncEngine.persistRoundSession.bind(roundSyncEngine);

afterEach(async () => {
  cleanup();
  latestSession = null;
  roundSyncEngine.bindOwner = originalBindOwner;
  roundSyncEngine.ensureNetworkListeners = originalEnsureNetworkListeners;
  roundSyncEngine.hydrateRoundSession = originalHydrate;
  roundSyncEngine.persistRoundSession = originalPersist;
  roundOutbox.setOwner(null);
  await roundOutbox.clear();
});

describe("RoundSessionProvider persistence owner boundary", () => {
  it("does not expose an interactive Round before continuity hydration completes", async () => {
    let finishHydration: (() => void) | null = null;
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = ({ fallbackRound }) => new Promise((resolve) => {
      finishHydration = () => resolve({
        round: fallbackRound,
        continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
      });
    });

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    assert.equal(latestSession?.isHydrated, false);
    act(() => finishHydration?.());
    await waitFor(() => assert.equal(latestSession?.isHydrated, true));
  });

  it("cancels a delayed save when the authenticated owner changes", async () => {
    const persistedOwners: string[] = [];
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async ({ round }) => {
      persistedOwners.push(round.userId);
    };

    const view = render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.continuity?.deviceId, "test-device"));
    act(() => latestSession?.nextPatient());
    await wait(25);

    view.rerender(
      <RoundSessionProvider userId="user-b" patientIds={["patient-c", "patient-d"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.round.userId, "user-b"));
    await wait(300);
    assert.deepEqual(persistedOwners, []);
  });

  it("still persists a current owner's round change", async () => {
    const persistedRounds: Round[] = [];
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async ({ round }) => {
      persistedRounds.push(round);
    };

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.continuity?.deviceId, "test-device"));
    act(() => latestSession?.nextPatient());
    await wait(300);

    assert.equal(persistedRounds.length, 1);
    assert.equal(persistedRounds[0]?.userId, "user-a");
  });
});
