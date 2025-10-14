import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';

interface TaskAssignmentCellProps {
  taskId: string;
  teamMembers: Array<{ id: string; name: string; color: string }>;
}

const getInitials = (name: string): string => {
  if (!name) return '';
  const words = name.trim().split(' ');
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

export default function TaskAssignmentCell({ taskId, teamMembers }: TaskAssignmentCellProps) {
  const [assignedCount, setAssignedCount] = useState(0);
  const [assignedMembers, setAssignedMembers] = useState<Array<{ id: string; name: string; color: string }>>([]);

  useEffect(() => {
    const fetchAssignments = async () => {
      const { data, error } = await supabase
        .from('incident_assignments')
        .select('assigned_to')
        .eq('incident_id', taskId);

      if (!error && data) {
        const members = data
          .map(a => teamMembers.find(m => m.id === a.assigned_to))
          .filter(Boolean) as Array<{ id: string; name: string; color: string }>;
        setAssignedCount(members.length);
        setAssignedMembers(members);
      }
    };

    fetchAssignments();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`assignments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incident_assignments',
          filter: `incident_id=eq.${taskId}`
        },
        () => {
          fetchAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, teamMembers]);

  if (assignedCount === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (assignedCount === 1) {
    const member = assignedMembers[0];
    if (!member) {
      return <span className="text-muted-foreground">-</span>;
    }
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
