import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useTaskAssignments } from '@/hooks/useTaskAssignments';
import { getAppStatusTone, getStatusLogLabel, getStatusLogValue } from '@/lib/taskStatus';
import { getRoleColor, getRoleInitial } from '@/lib/roleDisplay';

interface TaskAssignmentRolesReadonlyProps {
  taskId: string | null;
  roleByPersonId: Record<string, string>;
}

/**
 * Asignaciones de una tarea agrupadas por rol y en solo lectura (vista Cliente).
 * Cada rol aparece una vez, con los estados distintos de las personas que lo tienen.
 */
export default function TaskAssignmentRolesReadonly({ taskId, roleByPersonId }: TaskAssignmentRolesReadonlyProps) {
  const { assignments } = useTaskAssignments(taskId);

  const groups = useMemo(() => {
    const byRole = new Map<string, { label: string; statuses: string[] }>();
    assignments.forEach(assignment => {
      const label = (roleByPersonId[assignment.assigned_to] || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      const group = byRole.get(key) ?? { label, statuses: [] };
      const statusKey = getStatusLogValue(assignment.status, assignment.status_environment);
      if (!group.statuses.includes(statusKey)) group.statuses.push(statusKey);
      byRole.set(key, group);
    });
    return [...byRole.entries()].map(([key, group]) => ({ key, ...group }));
  }, [assignments, roleByPersonId]);

  if (groups.length === 0) {
    return <span className="text-sm text-muted-foreground">Sin asignar</span>;
  }

  return (
    <div className="space-y-2">
      {groups.map(group => (
        <div key={group.key} className="flex items-center gap-3 p-3 border rounded-lg">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: getRoleColor(group.label) }}
          >
            {getRoleInitial(group.label)}
          </div>
          <span className="flex-1 font-medium">{group.label}</span>
          <div className="flex flex-wrap items-center gap-1">
            {group.statuses.map(status => (
              <Badge key={status} variant="outline" className={`${getAppStatusTone(status)} border-transparent`}>
                {getStatusLogLabel(status)}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
