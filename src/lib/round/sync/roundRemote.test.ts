import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { remoteStateToRoundParts } from "./roundRemote";
import type { RoundStateRemoteRow } from "./types";

const createRemoteRow = (
  overrides: Partial<RoundStateRemoteRow> = {},
): RoundStateRemoteRow => ({
  id: "round-row",
  user_id: "owner-row",
  status: "completed",
  state: {
    id: "stale-state-id",
    userId: "stale-state-owner",
    status: "active",
    patients: [
      { patientId: " patient-a ", status: "done" },
      { patientId: "patient-a", status: "not-a-status" },
      { patientId: "", status: "pending" },
      "invalid-patient",
    ],
    currentIndex: 99,
    filters: { search: 42, hideDone: "yes", hideSkipped: true },
    activeSection: "invalid-section",
    expandedSystemId: "  neuro  ",
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z",
    continuity: {
      filtersUpdatedAt: 42,
      sectionUpdatedAt: "2026-08-10T09:30:00.000Z",
    },
  },
  position_updated_at: "2026-08-10T10:01:00.000Z",
  expanded_updated_at: "2026-08-10T10:02:00.000Z",
  device_id: "remote-device",
  created_at: "2026-08-10T08:00:00.000Z",
  updated_at: "2026-08-10T10:03:00.000Z",
  ...overrides,
});

describe("remoteStateToRoundParts", () => {
  it("uses authoritative row identity and lifecycle metadata", () => {
    const hydrated = remoteStateToRoundParts(createRemoteRow());

    assert.ok(hydrated);
    assert.equal(hydrated.round.id, "round-row");
    assert.equal(hydrated.round.userId, "owner-row");
    assert.equal(hydrated.round.status, "completed");
  });

  it("rejects remote rows without usable identity metadata", () => {
    assert.equal(remoteStateToRoundParts(createRemoteRow({ id: "   " })), null);
    assert.equal(remoteStateToRoundParts(createRemoteRow({ user_id: "" })), null);
  });

  it("sanitizes malformed remote continuity state before it reaches the UI", () => {
    const hydrated = remoteStateToRoundParts(createRemoteRow());

    assert.ok(hydrated);
    assert.deepEqual(hydrated.round.patients, [
      { patientId: "patient-a", status: "done" },
    ]);
    assert.equal(hydrated.round.currentIndex, 0);
    assert.deepEqual(hydrated.round.filters, {
      search: "",
      hideDone: false,
      hideSkipped: true,
    });
    assert.equal(hydrated.round.activeSection, "clinicalSummary");
    assert.equal(hydrated.round.expandedSystemId, "neuro");
    assert.equal(hydrated.continuity.filtersUpdatedAt, "2026-08-10T10:03:00.000Z");
    assert.equal(hydrated.continuity.sectionUpdatedAt, "2026-08-10T09:30:00.000Z");
  });
});
