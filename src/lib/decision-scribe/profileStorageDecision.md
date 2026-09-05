# Decision-scribe adaptation profile storage

The migration `20260904000000_create_decision_scribe_adaptation.sql` stores only
derived nonclinical signals and physician-owned reset/revoke controls. Profiles
are still derived fail-closed from verified, explicit attestation outcomes;
controls are durable barriers so recomputation cannot re-graduate old evidence.

If persistence is introduced later, the record must contain only:

- `physician_id` as the owner, pattern/context/model identifiers, counts/rates,
  timestamps, autonomy, revocation/reset state, and rationale codes;
- no transcript, audio, candidate text, patient identifiers, encounter IDs, or
  clinical content;
- row-level security requiring the authenticated physician (and actor) to
  read/write only their own rows, with service-side validation of ownership;
- a documented retention limit (30 days of evidence inputs; aggregate profile
  deletion on physician reset/revoke or account deletion) and an auditable
  rollback path.

Pending, rejected, unattested, conflicted, unverifiable, stale, or
cross-physician outcomes must never be used to graduate autonomy. Changed
context or model version always selects full review until independently
calibrated.
# Persistence enforcement (Step 7 iteration 2)

The executable migration persists only derived nonclinical signals and
physician-owned reset/revoke controls. `retained_until` is indexed and the
restricted `SECURITY DEFINER` function
`public.purge_expired_decision_scribe_adaptation()` is intended for scheduled
service-role invocation with a fixed `search_path`. Database checks enforce
controlled tokens and `actor_id = physician_id`; RLS is owner-only.

Rollback: after export and approval, drop the purge function and then the two
adaptation tables. No patient tables are touched. No transcript, audio,
candidate text, patient identifiers, encounter IDs, or clinical content are
stored.
