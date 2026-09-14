\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'composer_test' THEN RAISE EXCEPTION 'Use isolated composer_test database'; END IF; END $$;
BEGIN;
-- Run only in an isolated synthetic test database, after the composer migration.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.patients(id,user_id,clinical_summary,interval_events,systems,medications,code_status)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Original','Overnight','{"neuro":"Original neuro","custom":"Keep custom","skin":"Wound"}','{"scheduled":["Synthetic medication"]}','dnr');
DO $$
DECLARE r jsonb; before_row jsonb; after_row jsonb; history_count int;
BEGIN
  r := public.apply_reviewed_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"clinicalSummary":"Reviewed","systems.neuro":"Updated neuro","systems.skin":""}','{"profileVersion":"2026-09-13.1","mode":"concise"}');
  IF (r->>'revision')::int <> 1 THEN RAISE EXCEPTION 'Expected exactly one revision'; END IF;
  SELECT to_jsonb(p) INTO before_row FROM public.patients p;
  IF before_row->'systems'->>'custom' <> 'Keep custom' OR before_row->'systems'->>'skin' <> '' OR before_row->>'code_status' <> 'dnr' OR before_row->'medications'->'scheduled'->>0 <> 'Synthetic medication' THEN RAISE EXCEPTION 'Unrelated data changed or clear missing'; END IF;
  IF before_row->'note_format'->>'mode' <> 'concise' OR NOT (before_row->'field_timestamps' ? 'systems.neuro') THEN RAISE EXCEPTION 'Missing metadata or timestamps'; END IF;
  SELECT count(*) INTO history_count FROM patient_field_history;
  IF history_count <> 3 THEN RAISE EXCEPTION 'Expected field audit history'; END IF;
  r := public.apply_reviewed_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"clinicalSummary":"Reviewed","systems.neuro":"Updated neuro","systems.skin":""}','{"profileVersion":"2026-09-13.1","mode":"concise"}');
  IF r->>'replayed' <> 'true' THEN RAISE EXCEPTION 'Retry was not idempotent'; END IF;
  r := public.apply_reviewed_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"clinicalSummary":"Stale"}','{"profileVersion":"2026-09-13.1","mode":"standard"}');
  IF r->>'conflict' <> 'true' THEN RAISE EXCEPTION 'Stale revision accepted'; END IF;
  SELECT to_jsonb(p) INTO after_row FROM public.patients p;
  IF before_row <> after_row OR (SELECT count(*) FROM patient_field_history) <> history_count THEN RAISE EXCEPTION 'Retry or conflict mutated the chart'; END IF;
  BEGIN
    PERFORM public.apply_reviewed_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','{"clinicalSummary":"REJECT constraint","systems.neuro":"Must roll back"}','{"profileVersion":"2026-09-13.1","mode":"standard"}');
    RAISE EXCEPTION 'Constraint failure should reject';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT to_jsonb(p) INTO after_row FROM public.patients p;
  IF before_row <> after_row OR (SELECT count(*) FROM patient_field_history) <> history_count THEN RAISE EXCEPTION 'Partial save or audit escaped rollback'; END IF;
  BEGIN
    PERFORM public.apply_reviewed_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','{"medications":"Unapproved"}','{"profileVersion":"2026-09-13.1","mode":"standard"}');
    RAISE EXCEPTION 'Unapproved field accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  BEGIN
    PERFORM public.apply_reviewed_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'ffffffff-ffff-4fff-8fff-ffffffffffff','{"clinicalSummary":"Other owner"}','{"profileVersion":"2026-09-13.1","mode":"standard"}');
    RAISE EXCEPTION 'Wrong owner accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'PASS: atomicity, audit rollback, idempotency, stale revision, ownership, explicit clears, metadata and unrelated field preservation' AS result;

ROLLBACK;
