-- Aggregate, nonclinical adaptation signals and physician-owned controls.
create table if not exists public.decision_scribe_adaptation_profiles (
  physician_id uuid not null references auth.users(id) on delete cascade,
  pattern_key text not null,
  context_key text not null,
  model_version text not null,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  approval_rate numeric not null default 0 check (approval_rate between 0 and 1),
  edit_rate numeric not null default 0 check (edit_rate between 0 and 1),
  reversal_rate numeric not null default 0 check (reversal_rate between 0 and 1),
  contradiction_rate numeric not null default 0 check (contradiction_rate between 0 and 1),
  autonomy text not null default 'full-review' check (autonomy in ('full-review', 'exception-first')),
  revoked boolean not null default false,
  generated_at timestamptz not null default now(),
  retained_until timestamptz not null,
  check (retained_until > generated_at and retained_until <= generated_at + interval '90 days'),
  check (pattern_key ~ '^[a-z][a-z0-9._:-]{0,63}$' and pattern_key !~* '(patient|bed|mrn|encounter|room|name|dob|date)'),
  check (context_key ~ '^[a-z][a-z0-9._:-]{0,63}$' and context_key !~* '(patient|bed|mrn|encounter|room|name|dob|date)'),
  check (model_version ~ '^[a-z][a-z0-9._:-]{0,63}$' and model_version !~* '(patient|bed|mrn|encounter|room|name|dob|date)'),
  primary key (physician_id, pattern_key, context_key, model_version)
);

create table if not exists public.decision_scribe_adaptation_controls (
  id uuid primary key default gen_random_uuid(),
  physician_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  control_type text not null check (control_type in ('reset', 'revoke', 'reduce-autonomy')),
  pattern_key text,
  rationale_code text not null check (rationale_code in ('physician-request', 'reversal', 'drift', 'context-change', 'model-change', 'reset')),
  created_at timestamptz not null default now(),
  reset_before timestamptz,
  retained_until timestamptz not null,
  check (retained_until > created_at and retained_until <= created_at + interval '90 days'),
  check (actor_id = physician_id),
  check (pattern_key is null or (pattern_key ~ '^[a-z][a-z0-9._:-]{0,63}$' and pattern_key !~* '(patient|bed|mrn|encounter|room|name|dob|date)')),
  unique (physician_id, actor_id, control_type, pattern_key, created_at)
);

alter table public.decision_scribe_adaptation_profiles enable row level security;
alter table public.decision_scribe_adaptation_controls enable row level security;
create policy decision_scribe_adaptation_profiles_owner on public.decision_scribe_adaptation_profiles
  for all using (auth.uid() = physician_id) with check (auth.uid() = physician_id);
create policy decision_scribe_adaptation_controls_owner on public.decision_scribe_adaptation_controls
  for all using (auth.uid() = physician_id and auth.uid() = actor_id)
  with check (auth.uid() = physician_id and auth.uid() = actor_id);

create or replace function public.apply_decision_scribe_adaptation_control()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.actor_id <> new.physician_id then raise exception 'adaptation control owner mismatch'; end if;
  if new.control_type = 'reset' then
    delete from public.decision_scribe_adaptation_profiles where physician_id = new.physician_id;
  elsif new.control_type in ('revoke', 'reduce-autonomy') then
    delete from public.decision_scribe_adaptation_profiles where physician_id = new.physician_id and pattern_key = new.pattern_key;
  end if;
  return new;
end; $$;
create trigger decision_scribe_adaptation_control_apply
  before insert on public.decision_scribe_adaptation_controls
  for each row execute function public.apply_decision_scribe_adaptation_control();

create index if not exists decision_scribe_adaptation_profiles_retention_idx on public.decision_scribe_adaptation_profiles (retained_until);
create index if not exists decision_scribe_adaptation_controls_retention_idx on public.decision_scribe_adaptation_controls (retained_until);
create or replace function public.purge_expired_decision_scribe_adaptation()
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$ begin
  delete from public.decision_scribe_adaptation_controls where retained_until < now();
  delete from public.decision_scribe_adaptation_profiles where retained_until < now();
end; $$;
revoke all on function public.purge_expired_decision_scribe_adaptation() from public;
grant execute on function public.purge_expired_decision_scribe_adaptation() to service_role;

comment on table public.decision_scribe_adaptation_profiles is 'Nonclinical aggregate adaptation signals only; retained_until is mandatory.';
comment on table public.decision_scribe_adaptation_controls is 'Physician-owned reset/revoke controls; no patient or clinical payloads.';
