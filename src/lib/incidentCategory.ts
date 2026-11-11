export type EffectiveCategory = 'incident' | 'improvement' | 'corrective_improvement';

export const CATEGORY_LABELS: Record<EffectiveCategory, string> = {
  incident: 'Incidencia',
  improvement: 'Evolutivo',
  corrective_improvement: 'Mejora correctiva',
};

const CORRECTIVE_MARKER = '[tipo:mejora_correctiva]';

export const getEffectiveCategory = (
  incident: { category?: string | null; additional_comments?: string | null },
): EffectiveCategory => {
  if (incident.category === 'corrective_improvement' || String(incident.additional_comments ?? '').includes(CORRECTIVE_MARKER)) {
    return 'corrective_improvement';
  }
  return incident.category === 'improvement' ? 'improvement' : 'incident';
};

// null when the text is not a recognizable category, so it does not filter anything.
export const parseCategoryText = (value: string | null | undefined): EffectiveCategory | null => {
  const text = String(value ?? '').toLowerCase().trim();
  if (!text) return null;
  if (text.includes('correctiva') || text.includes('corrective')) return 'corrective_improvement';
  if (text.includes('evolutivo') || text.includes('mejora') || text.includes('improvement')) return 'improvement';
  if (text.includes('incidencia') || text.includes('incident')) return 'incident';
  return null;
};

// The same ID can exist once per category, so the Excel "Tipo" decides between candidates.
export const findIncidentByIdAndType = <T extends { category?: string | null; additional_comments?: string | null }>(
  candidates: T[] | undefined,
  typeText: string,
): { incident: T | null; ambiguous: boolean } => {
  if (!candidates || candidates.length === 0) return { incident: null, ambiguous: false };

  const wanted = parseCategoryText(typeText);
  if (wanted) {
    const match = candidates.find((candidate) => getEffectiveCategory(candidate) === wanted);
    return { incident: match ?? null, ambiguous: false };
  }

  if (candidates.length === 1) return { incident: candidates[0], ambiguous: false };
  return { incident: null, ambiguous: true };
};
