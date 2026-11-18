import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORY_LABELS, type EffectiveCategory } from '@/lib/incidentCategory';

export type ProjectRole = 'team' | 'client';

export interface ProjectRoleState {
  role: ProjectRole;
  isClient: boolean;
  /** null = todas las categorías */
  allowedCategories: EffectiveCategory[] | null;
  /** null = todas las épicas */
  allowedEpics: string[] | null;
  loading: boolean;
}

const DEFAULT_STATE: ProjectRoleState = {
  role: 'team',
  isClient: false,
  allowedCategories: null,
  allowedEpics: null,
  loading: false,
};

const ProjectRoleContext = createContext<ProjectRoleState>(DEFAULT_STATE);

const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS) as EffectiveCategory[];

const normalizeList = <T extends string>(value: unknown, allowed?: readonly T[]): T[] | null => {
  if (!Array.isArray(value)) return null;
  const list = value
    .map(item => String(item ?? '').trim())
    .filter(Boolean)
    .filter(item => !allowed || (allowed as readonly string[]).includes(item)) as T[];
  return list.length > 0 ? list : null;
};

export function useLoadProjectRole(projectId: string | undefined, userId: string | undefined): ProjectRoleState {
  const [state, setState] = useState<ProjectRoleState>({ ...DEFAULT_STATE, loading: true });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!projectId || !userId) {
        setState(DEFAULT_STATE);
        return;
      }

      setState(prev => ({ ...prev, loading: true }));

      const [{ data: isAdmin }, { data: access }] = await Promise.all([
        supabase.rpc('current_user_is_admin'),
        (supabase.from('project_access') as any)
          .select('role, allowed_categories, allowed_epics')
          .eq('user_id', userId)
          .eq('project_id', projectId)
          .maybeSingle(),
      ]);

      if (!isMounted) return;

      const isClient = !isAdmin && access?.role === 'client';
      setState({
        role: isClient ? 'client' : 'team',
        isClient,
        allowedCategories: isClient ? normalizeList(access?.allowed_categories, VALID_CATEGORIES) : null,
        allowedEpics: isClient ? normalizeList(access?.allowed_epics) : null,
        loading: false,
      });
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [projectId, userId]);

  return state;
}

export function ProjectRoleProvider({ value, children }: { value: ProjectRoleState; children: ReactNode }) {
  return <ProjectRoleContext.Provider value={value}>{children}</ProjectRoleContext.Provider>;
}

export const useProjectRole = () => useContext(ProjectRoleContext);

/** Rutas del proyecto visibles para el rol Cliente. */
export const CLIENT_ALLOWED_ROUTES = ['tasks', 'releases'] as const;

export const isCategoryAllowed = (scope: ProjectRoleState, category: string) =>
  !scope.allowedCategories || scope.allowedCategories.includes(category as EffectiveCategory);

export const isEpicAllowed = (scope: ProjectRoleState, epic: string | null | undefined) =>
  !scope.allowedEpics || (!!epic && scope.allowedEpics.includes(epic));
