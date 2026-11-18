import { memo, useMemo } from 'react';
import { Users } from 'lucide-react';
import RoleCircles from '@/components/RoleCircles';

interface Member {
  id: string;
  name: string;
  color: string;
}

interface TaskAssignmentCellProps {
  assignedIds: string[] | undefined;
  teamMembers: Member[];
  /** Vista Cliente: se muestran roles (sin nombres) a partir de este mapa id de persona -> rol. */
  roleByPersonId?: Record<string, string>;
}

const getInitials = (name: string): string => {
  if (!name) return '';
  const words = name.trim().split(' ');
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

function TaskAssignmentCell({ assignedIds, teamMembers, roleByPersonId }: TaskAssignmentCellProps) {
  const assignedMembers = useMemo(
    () => (assignedIds || [])
      .map(id => teamMembers.find(m => m.id === id))
      .filter(Boolean) as Member[],
    [assignedIds, teamMembers]
  );
  const assignedCount = assignedMembers.length;

  if (roleByPersonId) {
    return <RoleCircles roles={(assignedIds || []).map(id => roleByPersonId[id])} />;
  }

  if (assignedCount === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (assignedCount === 1) {
    const member = assignedMembers[0];
    return (
      <div className="flex items-center justify-center">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
          style={{ backgroundColor: member.color }}
          title={member.name}
        >
          {getInitials(member.name)}
        </div>
      </div>
    );
  }

  // Multiple assignments
  return (
    <div className="flex items-center justify-center">
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center bg-white border-2 border-black"
        title={assignedMembers.map(m => m.name).join(', ')}
      >
        <Users className="w-4 h-4 text-black" />
      </div>
    </div>
  );
}

export default memo(TaskAssignmentCell);
