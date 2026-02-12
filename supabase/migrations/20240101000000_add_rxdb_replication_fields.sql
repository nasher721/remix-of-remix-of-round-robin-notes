-- Add _modified and _deleted columns for RxDB Supabase replication
-- Run this migration in Supabase SQL Editor

-- Add _modified timestamp column (required for replication)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS _modified BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000;

-- Add _deleted soft-delete column (required for replication)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS _deleted BOOLEAN DEFAULT FALSE;

-- Create index on _modified for efficient replication queries
CREATE INDEX IF NOT EXISTS idx_patients_modified ON patients(_modified);

-- Create index on user_id + _modified for user-scoped replication
CREATE INDEX IF NOT EXISTS idx_patients_user_modified ON patients(user_id, _modified);

-- Create function to auto-update _modified timestamp
CREATE OR REPLACE FUNCTION update_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW._modified := EXTRACT(EPOCH FROM NOW()) * 1000;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update _modified on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_patients_modified ON patients;
CREATE TRIGGER trigger_patients_modified
  BEFORE INSERT OR UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_timestamp();

-- Enable Realtime for patients table (for Supabase Realtime integration)
-- Run: ALTER publication supabase_realtime ADD TABLE patients;
-- Or enable via Supabase Dashboard > Database > Replication

-- Create RLS policies for user-scoped data access (if not exists)
-- These ensure users can only access their own patients

-- Policy: Users can view their own patients
CREATE POLICY "Users can view own patients" ON patients
  FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own patients
CREATE POLICY "Users can insert own patients" ON patients
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own patients
CREATE POLICY "Users can update own patients" ON patients
  FOR UPDATE USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can delete their own patients (soft delete via _deleted)
CREATE POLICY "Users can delete own patients" ON patients
  FOR DELETE USING (auth.uid()::text = user_id);
