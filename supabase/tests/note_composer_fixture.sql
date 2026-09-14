\set ON_ERROR_STOP on
-- Dedicated, disposable database only. Never run against a hosted application database.
DO $$ BEGIN IF current_database() <> 'composer_test' THEN RAISE EXCEPTION 'Use isolated composer_test database'; END IF; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.patients(id uuid PRIMARY KEY, user_id uuid NOT NULL, clinical_summary text NOT NULL DEFAULT '' CHECK (clinical_summary NOT LIKE 'REJECT%'), interval_events text NOT NULL DEFAULT '', systems jsonb DEFAULT '{}', medications jsonb DEFAULT '{}', code_status text, field_timestamps jsonb DEFAULT '{}', last_modified timestamptz DEFAULT now(), revision bigint NOT NULL DEFAULT 0);
CREATE TABLE public.patient_field_history(id uuid DEFAULT gen_random_uuid(),patient_id uuid,user_id uuid,field_name text,old_value text,new_value text,changed_at timestamptz DEFAULT now());
CREATE TABLE public.user_settings(id uuid DEFAULT gen_random_uuid(),user_id uuid UNIQUE);
CREATE FUNCTION public.bump_patient_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.revision = OLD.revision + 1; RETURN NEW; END $$;
CREATE TRIGGER bump_patient_revision BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.bump_patient_revision();
