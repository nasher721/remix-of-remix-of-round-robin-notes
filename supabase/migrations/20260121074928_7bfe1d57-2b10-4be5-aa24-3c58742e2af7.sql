-- Create a security definer function to check if a user is a team admin
-- This avoids infinite recursion when querying phrase_team_members from its own RLS policy
CREATE OR REPLACE FUNCTION public.is_phrase_team_admin(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.phrase_team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Drop the buggy policies that have 'm.team_id = m.team_id' tautology
DROP POLICY IF EXISTS "Team admins can manage members" ON public.phrase_team_members;
DROP POLICY IF EXISTS "Team admins can remove members" ON public.phrase_team_members;
DROP POLICY IF EXISTS "Team admins can update members" ON public.phrase_team_members;

-- Recreate INSERT policy with fixed logic
CREATE POLICY "Team admins can manage members" 
ON public.phrase_team_members 
FOR INSERT 
WITH CHECK (
  -- Owner of the team can add members
  EXISTS (
    SELECT 1 FROM phrase_teams t
    WHERE t.id = phrase_team_members.team_id 
      AND t.owner_id = auth.uid()
  )
  OR
  -- Team admin can add members (using security definer function)
  public.is_phrase_team_admin(phrase_team_members.team_id, auth.uid())
);

-- Recreate DELETE policy with fixed logic
CREATE POLICY "Team admins can remove members" 
ON public.phrase_team_members 
FOR DELETE 
USING (
  -- Users can remove themselves
  user_id = auth.uid()
  OR
  -- Owner can remove anyone
  EXISTS (
    SELECT 1 FROM phrase_teams t
    WHERE t.id = phrase_team_members.team_id 
      AND t.owner_id = auth.uid()
  )
  OR
  -- Team admin can remove members (using security definer function)
  public.is_phrase_team_admin(phrase_team_members.team_id, auth.uid())
);

-- Recreate UPDATE policy with fixed logic
CREATE POLICY "Team admins can update members" 
ON public.phrase_team_members 
FOR UPDATE 
USING (
  -- Owner can update anyone
  EXISTS (
    SELECT 1 FROM phrase_teams t
    WHERE t.id = phrase_team_members.team_id 
      AND t.owner_id = auth.uid()
  )
  OR
  -- Team admin can update members (using security definer function)
  public.is_phrase_team_admin(phrase_team_members.team_id, auth.uid())
);