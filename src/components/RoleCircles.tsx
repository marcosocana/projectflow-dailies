import { memo } from 'react';
import { groupRoles } from '@/lib/roleDisplay';

interface RoleCirclesProps {
  roles: Array<string | null | undefined>;
}

/** Un círculo de color con la inicial por cada rol distinto. */
function RoleCircles({ roles }: RoleCirclesProps) {
  const groups = groupRoles(roles);

  if (groups.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex items-center justify-center -space-x-3">
      {groups.map(group => (
        <div
          key={group.key}
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-background transition-transform hover:z-10 hover:scale-110"
          style={{ backgroundColor: group.color }}
          title={group.label}
        >
          {group.initial}
        </div>
      ))}
    </div>
  );
}

export default memo(RoleCircles);
