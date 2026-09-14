-- Accepted chart content only. Temporary sources/drafts/evidence never enter SQL.
BEGIN;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS note_format jsonb;
CREATE TABLE public.note_composer_operations (
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  payload_hash text NOT NULL,
  applied_revision bigint NOT NULL,
  PRIMARY KEY (patient_id, operation_id)
);
ALTER TABLE public.note_composer_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.note_composer_operations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_reviewed_note(
  p_patient_id uuid, p_expected_revision bigint, p_operation_id uuid,
  p_fields jsonb, p_format jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  patient public.patients%ROWTYPE;
  prior public.note_composer_operations%ROWTYPE;
  item record;
  system_patch jsonb := '{}'::jsonb;
  timestamps jsonb := '{}'::jsonb;
  body_hash text := md5(p_fields::text || p_format::text || p_expected_revision::text);
  old_text text;
BEGIN
  SELECT * INTO patient FROM public.patients
    WHERE id = p_patient_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient access denied' USING ERRCODE = '42501'; END IF;
  SELECT * INTO prior FROM public.note_composer_operations
    WHERE patient_id = p_patient_id AND operation_id = p_operation_id;
  IF FOUND THEN
    IF prior.payload_hash <> body_hash THEN RAISE EXCEPTION 'Operation payload mismatch' USING ERRCODE = '22023'; END IF;
    RETURN jsonb_build_object('revision', prior.applied_revision, 'replayed', true);
  END IF;
  IF patient.revision <> p_expected_revision THEN
    RETURN jsonb_build_object('conflict', true, 'revision', patient.revision);
  END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' OR p_format IS NULL
    OR jsonb_typeof(p_format) <> 'object' OR p_format->>'profileVersion' IS DISTINCT FROM '2026-09-13.1'
    OR p_format->>'mode' IS NULL OR p_format->>'mode' NOT IN ('standard', 'concise')
    OR p_format - ARRAY['profileVersion','mode'] <> '{}'::jsonb
    OR octet_length(p_fields::text) > 1000000 THEN
    RAISE EXCEPTION 'Invalid accepted note' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT key, value FROM jsonb_each(p_fields) LOOP
    IF item.key NOT IN ('clinicalSummary','intervalEvents','systems.neuro','systems.cv','systems.resp','systems.renalGU','systems.gi','systems.endo','systems.heme','systems.infectious','systems.skinLines','systems.skin','systems.dispo')
      OR jsonb_typeof(item.value) <> 'string' THEN
      RAISE EXCEPTION 'Invalid note field' USING ERRCODE = '22023';
    END IF;
    IF item.key LIKE 'systems.%' THEN
      system_patch := system_patch || jsonb_build_object(substr(item.key,9), item.value);
      old_text := patient.systems->>substr(item.key,9);
    ELSIF item.key = 'clinicalSummary' THEN old_text := patient.clinical_summary;
    ELSE old_text := patient.interval_events;
    END IF;
    timestamps := timestamps || jsonb_build_object(item.key, now());
    INSERT INTO public.patient_field_history(patient_id,user_id,field_name,old_value,new_value)
      VALUES (p_patient_id,auth.uid(),item.key,old_text,item.value #>> '{}');
  END LOOP;
  UPDATE public.patients SET
    clinical_summary = CASE WHEN p_fields ? 'clinicalSummary' THEN p_fields->>'clinicalSummary' ELSE clinical_summary END,
    interval_events = CASE WHEN p_fields ? 'intervalEvents' THEN p_fields->>'intervalEvents' ELSE interval_events END,
    systems = coalesce(systems,'{}'::jsonb) || system_patch,
    field_timestamps = coalesce(field_timestamps,'{}'::jsonb) || timestamps,
    note_format = p_format,
    last_modified = now()
    WHERE id = p_patient_id RETURNING * INTO patient;
  INSERT INTO public.note_composer_operations VALUES (p_patient_id,p_operation_id,body_hash,patient.revision);
  RETURN jsonb_build_object('revision',patient.revision,'replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_reviewed_note(uuid,bigint,uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_reviewed_note(uuid,bigint,uuid,jsonb,jsonb) TO authenticated;
COMMIT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS note_composer_mode text NOT NULL DEFAULT 'standard' CHECK (note_composer_mode IN ('standard','concise'));
