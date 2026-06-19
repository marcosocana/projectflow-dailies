CREATE TABLE IF NOT EXISTS public.project_cost_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0f766e',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

ALTER TABLE public.project_cost_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view project cost tags" ON public.project_cost_tags;
CREATE POLICY "Admins can view project cost tags"
  ON public.project_cost_tags FOR SELECT
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP POLICY IF EXISTS "Admins can create project cost tags" ON public.project_cost_tags;
CREATE POLICY "Admins can create project cost tags"
  ON public.project_cost_tags FOR INSERT
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP POLICY IF EXISTS "Admins can update project cost tags" ON public.project_cost_tags;
CREATE POLICY "Admins can update project cost tags"
  ON public.project_cost_tags FOR UPDATE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP POLICY IF EXISTS "Admins can delete project cost tags" ON public.project_cost_tags;
CREATE POLICY "Admins can delete project cost tags"
  ON public.project_cost_tags FOR DELETE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP TRIGGER IF EXISTS update_project_cost_tags_updated_at ON public.project_cost_tags;
CREATE TRIGGER update_project_cost_tags_updated_at
  BEFORE UPDATE ON public.project_cost_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.project_cost_tags (project_id, name, color)
SELECT id, 'Evolutivo', '#2563eb'
FROM public.projects
ON CONFLICT (project_id, name) DO NOTHING;

INSERT INTO public.project_cost_tags (project_id, name, color)
SELECT id, 'Correctivo', '#dc2626'
FROM public.projects
ON CONFLICT (project_id, name) DO NOTHING;
