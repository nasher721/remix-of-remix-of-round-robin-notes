import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(repositoryRoot, "supabase", "migrations");
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const historicalRxdbMigration = "20240101000000_add_rxdb_replication_fields.sql";
const historicalOptimizationMigration = "20250315120000_optimize_postgres_indexes_rls.sql";
const catchUpMigration = "20260711000000_replay_deferred_schema_hardening.sql";
const privateImagesMigration = "20260205190811_53775f4e-5179-4c57-b663-686ce92b671e.sql";
const childOwnershipMigration = "20260711200000_harden_child_record_ownership.sql";
const distributedRateLimitsMigration = "20260711230000_add_distributed_edge_rate_limits.sql";

const readMigration = async (file) =>
  readFile(path.join(migrationsDirectory, file), "utf8");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const requiredFile of [
  historicalRxdbMigration,
  historicalOptimizationMigration,
  catchUpMigration,
  privateImagesMigration,
  childOwnershipMigration,
  distributedRateLimitsMigration,
]) {
  assert(migrationFiles.includes(requiredFile), `Missing migration: ${requiredFile}`);
}

const rxdbSql = await readMigration(historicalRxdbMigration);
assert.match(
  rxdbSql,
  /to_regclass\('public\.patients'\) IS NULL/i,
  "The historical RxDB migration must skip table work until public.patients exists",
);

const deferredRelations = [
  "patients",
  "patient_todos",
  "autotexts",
  "templates",
  "phrase_folders",
  "phrase_teams",
  "phrase_team_members",
  "phrase_usage_log",
  "patient_field_history",
  "user_settings",
  "user_dictionary",
];

const optimizationSql = await readMigration(historicalOptimizationMigration);
for (const relation of deferredRelations) {
  assert.match(
    optimizationSql,
    new RegExp(`to_regclass\\('public\\.${escapeRegExp(relation)}'\\) IS NULL`, "i"),
    `The historical optimization migration must guard public.${relation}`,
  );
}

const catchUpIndex = migrationFiles.indexOf(catchUpMigration);
for (const relation of deferredRelations) {
  const createPattern = new RegExp(
    `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+public\\.${escapeRegExp(relation)}\\b`,
    "i",
  );
  const creatorIndex = await (async () => {
    for (let index = 0; index < migrationFiles.length; index += 1) {
      if (createPattern.test(await readMigration(migrationFiles[index]))) return index;
    }
    return -1;
  })();

  assert.notEqual(creatorIndex, -1, `No migration creates public.${relation}`);
  assert(
    creatorIndex < catchUpIndex,
    `The catch-up migration runs before public.${relation} is created`,
  );
}

const catchUpSql = await readMigration(catchUpMigration);
for (const requiredIndex of [
  "idx_patients_modified",
  "idx_patients_user_modified",
  "idx_patient_todos_patient_id",
  "idx_patient_todos_user_id",
  "idx_autotexts_user_id",
  "idx_templates_user_id",
  "idx_phrase_folders_user_id",
  "idx_phrase_folders_parent_id",
  "idx_phrase_folders_team_id",
  "idx_phrase_teams_owner_id",
  "idx_phrase_team_members_team_id",
  "idx_phrase_team_members_user_id",
  "idx_phrase_usage_log_phrase_id",
  "idx_phrase_usage_log_patient_id",
  "idx_patient_field_history_user_id",
]) {
  assert.match(
    catchUpSql,
    new RegExp(`CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${requiredIndex}\\b`, "i"),
    `The catch-up migration is missing ${requiredIndex}`,
  );
}

assert.match(catchUpSql, /ADD COLUMN IF NOT EXISTS _modified bigint/i);
assert.match(catchUpSql, /ADD COLUMN IF NOT EXISTS _deleted boolean/i);
assert.match(catchUpSql, /CREATE TRIGGER trigger_patients_modified/i);

for (const relation of [
  "patients",
  "patient_todos",
  "autotexts",
  "templates",
  "user_settings",
  "user_dictionary",
  "patient_field_history",
]) {
  assert.match(
    catchUpSql,
    new RegExp(`ALTER\\s+TABLE\\s+public\\.${relation}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i"),
    `The catch-up migration does not explicitly enable RLS on public.${relation}`,
  );
}

for (const policyName of [
  "Users can view their own patients",
  "Users can create their own patients",
  "Users can update their own patients",
  "Users can delete their own patients",
  "Users can view their own todos",
  "Users can create their own todos",
  "Users can update their own todos",
  "Users can delete their own todos",
  "Users can view their own autotexts",
  "Users can create their own autotexts",
  "Users can update their own autotexts",
  "Users can delete their own autotexts",
  "Users can view their own templates",
  "Users can create their own templates",
  "Users can update their own templates",
  "Users can delete their own templates",
  "Users can view their own settings",
  "Users can create their own settings",
  "Users can update their own settings",
  "Users can view their own dictionary entries",
  "Users can create their own dictionary entries",
  "Users can update their own dictionary entries",
  "Users can delete their own dictionary entries",
  "Users can view their own field history",
  "Users can create their own field history",
  "Users can delete their own field history",
]) {
  assert.match(
    catchUpSql,
    new RegExp(`CREATE\\s+POLICY\\s+"${escapeRegExp(policyName)}"`, "i"),
    `The catch-up migration is missing policy: ${policyName}`,
  );
}

for (const match of catchUpSql.matchAll(/CREATE POLICY\s+"([^"]+)"/gi)) {
  const policyName = match[1];
  const precedingSql = catchUpSql.slice(0, match.index);
  assert.match(
    precedingSql,
    new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${escapeRegExp(policyName)}"`, "i"),
    `Policy ${policyName} is not dropped before it is recreated`,
  );
}

assert.doesNotMatch(
  catchUpSql,
  /storage\.buckets|Public can view patient images/i,
  "The catch-up migration must not alter patient-images privacy",
);

const childOwnershipSql = await readMigration(childOwnershipMigration);
for (const relation of ["patient_todos", "patient_field_history"]) {
  assert.match(
    childOwnershipSql,
    new RegExp(
      `ON\\s+public\\.${relation}[\\s\\S]+?patient\\.id\\s*=\\s*patient_id[\\s\\S]+?patient\\.user_id\\s*=\\s*auth\\.uid\\(\\)`,
      "i",
    ),
    `${relation} policies must bind child rows to a patient owned by auth.uid()`,
  );
}
assert.match(
  childOwnershipSql,
  /phrase_usage_log_metadata_only[\s\S]*CHECK\s*\(input_values IS NULL AND inserted_content IS NULL\)[\s\S]*NOT VALID/i,
  "Phrase usage must reject new expanded clinical content without purging legacy rows",
);
assert.match(
  childOwnershipSql,
  /REVOKE SELECT, INSERT ON TABLE public\.phrase_usage_log FROM authenticated/i,
  "Browser roles must not retain table-wide access to legacy phrase payloads",
);
const phraseUsageSelectGrant = childOwnershipSql.match(
  /GRANT SELECT\s*\([\s\S]*?\) ON TABLE public\.phrase_usage_log TO authenticated/i,
)?.[0] ?? "";
assert.doesNotMatch(
  phraseUsageSelectGrant,
  /input_values|inserted_content/i,
  "Browser roles must not be able to read legacy phrase payload columns",
);
assert.match(
  childOwnershipSql,
  /phrase\.id\s*=\s*phrase_id[\s\S]*phrase\.user_id\s*=\s*auth\.uid\(\)/i,
  "Phrase usage rows must reference a phrase owned by auth.uid()",
);
assert.match(
  childOwnershipSql,
  /patient_id IS NULL[\s\S]*patient\.id\s*=\s*patient_id[\s\S]*patient\.user_id\s*=\s*auth\.uid\(\)/i,
  "Phrase usage patient references must be null or owned by auth.uid()",
);
assert.match(
  childOwnershipSql,
  /SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*folder\.id\s*=\s*target_folder_id[\s\S]*folder\.user_id\s*=\s*auth\.uid\(\)/i,
  "Nested phrase folders must belong to the authenticated owner",
);
assert.match(
  childOwnershipSql,
  /team_id IS NULL[\s\S]*private\.can_manage_phrase_team\(team_id\)/i,
  "Team-linked phrase folders must belong to a team the user can manage",
);
assert.match(
  childOwnershipSql,
  /folder_id IS NULL[\s\S]*private\.is_owned_phrase_folder\(folder_id\)/i,
  "Clinical phrases must reference a folder owned by the authenticated user",
);

const distributedRateLimitsSql = await readMigration(distributedRateLimitsMigration);
assert.match(
  distributedRateLimitsSql,
  /CREATE TABLE IF NOT EXISTS public\.edge_rate_limits/i,
  "Distributed rate limits require durable shared state",
);
assert.match(
  distributedRateLimitsSql,
  /ON CONFLICT\s*\(rate_key\)\s*DO UPDATE/i,
  "Rate-limit quota consumption must be atomic",
);
assert.match(
  distributedRateLimitsSql,
  /SECURITY DEFINER[\s\S]*SET search_path = ''/i,
  "Rate-limit RPC must use a fixed search path",
);
assert.match(
  distributedRateLimitsSql,
  /REVOKE ALL ON FUNCTION public\.consume_edge_rate_limit\([^)]+\)\s+FROM PUBLIC/i,
  "Rate-limit RPC must not be callable by browser roles",
);
assert.match(
  distributedRateLimitsSql,
  /GRANT EXECUTE ON FUNCTION public\.consume_edge_rate_limit\([^)]+\)\s+TO service_role/i,
  "Only the Edge service role should consume distributed quota",
);

console.log(
  `Verified ${migrationFiles.length} migrations: historical guards, dependency order, idempotent catch-up policies, and patient-images isolation.`,
);
