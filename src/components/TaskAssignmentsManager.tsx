import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { useTaskAssignments } from '@/hooks/useTaskAssignments';
import { updateTaskStatusFromAssignments } from '@/hooks/useSyncTaskStatus';
import type { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];

interface TaskAssignmentsManagerProps {
  taskId: string | null;
  teamMembers: Array<{ id: string; name: string; color: string }>;
  onAssignmentsChange?: () => void;
}

const STATUS_OPTIONS: Array<{ value: IncidentStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'in_qa', label: 'En pruebas' },
  { value: 'resolved', label: 'Resuelta' },
  { value: 'closed', label: 'Cerrada' }
];

const STATUS_COLORS: Record<IncidentStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
  in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
  resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  closed: 'bg-destructive text-destructive-foreground'
};

export default function TaskAssignmentsManager({ 
  taskId, 
  teamMembers,
  onAssignmentsChange 
}: TaskAssignmentsManagerProps) {
  const { assignments, addAssignment, updateAssignmentStatus, removeAssignment } = useTaskAssignments(taskId);
  const [selectedMember, setSelectedMember] = useState<string>('');

  const handleAddAssignment = async () => {
    if (!selectedMember || !taskId) return;

    // Check if already assigned
    if (assignments.some(a => a.assigned_to === selectedMember)) {
      return;
    }

    try {
      await addAssignment(selectedMember);
      setSelectedMember('');
      onAssignmentsChange?.();
    } catch (error) {
      console.error('Error adding assignment:', error);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await removeAssignment(assignmentId);
      onAssignmentsChange?.();
    } catch (error) {
      console.error('Error removing assignment:', error);
    }
  };

  const handleUpdateStatus = async (assignmentId: string, status: IncidentStatus) => {
    try {
      await updateAssignmentStatus(assignmentId, status);
      
      // Sincronizar el estado general de la tarea
      if (taskId) {
        await updateTaskStatusFromAssignments(taskId);
      }
      
      onAssignmentsChange?.();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return '';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const availableMembers = teamMembers.filter(
    member => !assignments.some(a => a.assigned_to === member.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedMember} onValueChange={setSelectedMember}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Seleccionar persona..." />
          </SelectTrigger>
          <SelectContent>
            {availableMembers.map(member => (
              <SelectItem key={member.id} value={member.id}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color }} />
                  {member.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          onClick={handleAddAssignment} 
          disabled={!selectedMember}
          size="sm"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {assignments.map(assignment => {
          const member = teamMembers.find(m => m.id === assignment.assigned_to);
          if (!member) return null;

          return (
            <div key={assignment.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                style={{ backgroundColor: member.color }}
                title={member.name}
              >
                {getInitials(member.name)}
              </div>
              
              <span className="flex-1 font-medium">{member.name}</span>
              
              <Select 
                value={assignment.status} 
                onValueChange={(value: IncidentStatus) => handleUpdateStatus(assignment.id, value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="outline" className={`${STATUS_COLORS[assignment.status]} border-transparent`}>
                {STATUS_OPTIONS.find(s => s.value === assignment.status)?.label}
              </Badge>

              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleRemoveAssignment(assignment.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {assignments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay personas asignadas
          </p>
        )}
      </div>
    </div>
  );
}
