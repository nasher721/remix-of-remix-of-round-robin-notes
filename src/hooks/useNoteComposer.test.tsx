import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useNoteComposer } from "./useNoteComposer";
import {
  defaultMedications,
  defaultSystems,
  type Patient,
} from "@/types/patient";
const patient: Patient = {
  id: "p1",
  name: "Synthetic",
  mrn: "",
  bed: "",
  patientNumber: 1,
  clinicalSummary: "First patient",
  intervalEvents: "",
  labs: "",
  imaging: "",
  systems: { ...defaultSystems },
  medications: defaultMedications,
  fieldTimestamps: {},
  createdAt: "",
  lastModified: "",
  collapsed: false,
};
const transport = {
  generate: async () => {
    throw new Error("Unavailable");
  },
  apply: async () => ({ revision: 1 }),
};
test("StrictMode lifecycle remains editable and owner switch destroys old temporary state", async () => {
  const hook = renderHook(
    ({ owner }) => useNoteComposer(owner, patient, transport),
    {
      initialProps: { owner: "u1" },
      wrapper: ({ children }) => <React.StrictMode>{children}
      </React.StrictMode>,
    },
  );
  await waitFor(() => assert.ok(hook.result.current));
  const old = hook.result.current!;
  act(() => old.setAttending("Temporary first owner"));
  assert.equal(old.state.attending, "Temporary first owner");
  hook.rerender({ owner: "u2" });
    await waitFor(() => assert.equal(hook.result.current, null));
  assert.equal(old.state.attending, "");
  hook.unmount();
});
