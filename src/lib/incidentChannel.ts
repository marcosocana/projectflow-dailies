// "Ambos" = la tarea afecta a APP y Web.
export const showsAppVersion = (device: string | null | undefined) => device === 'APP' || device === 'Ambos';

// Filtrar por APP o Web también muestra las tareas de canal "Ambos".
export const matchesChannelFilter = (device: string | null | undefined, filter: string) =>
  filter === 'all' || device === filter || (device === 'Ambos' && (filter === 'APP' || filter === 'Web'));
