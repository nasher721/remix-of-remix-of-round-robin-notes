-- Create a function to get team_id from a phrase's folder
CREATE OR REPLACE FUNCTION public.get_phrase_team_id(_phrase_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pf.team_id
  FROM public.clinical_phrases cp
  LEFT JOIN public.phrase_folders pf ON cp.folder_id = pf.id
  WHERE cp.id = _phrase_id
$$;

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view their own and shared phrases" ON public.clinical_phrases;

-- Create new policy with team-based access control
-- Users can view:
-- 1. Their own phrases
-- 2. Shared phrases ONLY if they are a member of the folder's team
CREATE POLICY "Users can view their own and team phrases" 
ON public.clinical_phrases 
FOR SELECT 
USING (
  -- User owns the phrase
  auth.uid() = user_id
  OR
  -- Phrase is shared AND belongs to a folder with a team AND user is a team member
  (
    is_shared = true 
    AND folder_id IS NOT NULL
    AND public.get_phrase_team_id(id) IS NOT NULL
    AND public.is_phrase_team_member(public.get_phrase_team_id(id), auth.uid())
  )
);