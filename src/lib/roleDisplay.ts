// Presentación de los roles del equipo (people.role) para la vista Cliente.
// El rol es texto libre, así que se agrupa por el texto normalizado y la letra
// del círculo es la primera del texto.

const normalizeRole = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const FIXED_ROLE_COLORS: Array<{ matches: (key: string) => boolean; color: string }> = [
  { matches: key => key === 'app', color: '#2563EB' },
  { matches: key => key === 'web', color: '#16A34A' },
  { matches: key => key === 'back', color: '#EA580C' },
  { matches: key => key.startsWith('disen'), color: '#9333EA' },
];

export const getRoleColor = (role: string | null | undefined): string => {
  const key = normalizeRole(role);
  const fixed = FIXED_ROLE_COLORS.find(item => item.matches(key));
  if (fixed) return fixed.color;

  // Roles no previstos: color estable generado a partir del texto.
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return `hsl(${hash % 360} 55% 40%)`;
};

export const getRoleInitial = (role: string | null | undefined): string =>
  String(role ?? '').trim().charAt(0).toUpperCase();

export interface RoleGroup {
  key: string;
  label: string;
  initial: string;
  color: string;
}

/** Roles distintos, en orden de aparición. Ignora los vacíos y repetidos. */
export const groupRoles = (roles: Array<string | null | undefined>): RoleGroup[] => {
  const groups = new Map<string, RoleGroup>();
  roles.forEach(role => {
    const label = String(role ?? '').trim();
    const key = normalizeRole(label);
    if (!key || groups.has(key)) return;
    groups.set(key, { key, label, initial: getRoleInitial(label), color: getRoleColor(label) });
  });
  return [...groups.values()];
};
