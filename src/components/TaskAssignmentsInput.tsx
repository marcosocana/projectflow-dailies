import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];

export interface TaskAssignment {
  person: string;
  status: IncidentStatus;
}

interface TaskAssignmentsInputProps {
  teamMembers: Array<{ id: string; name: string; color: string }>;
  assignments: TaskAssignment[];
  onAssignmentsChange: (assignments: TaskAssignment[]) => void;
}

const STATUS_OPTIONS: Array<{ value: IncidentStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'WIP' },
  { value: 'in_qa', label: 'En QA' },
  { value: 'resolved', label: 'En PRO' },
  { value: 'closed', label: 'Cerrada' }
];

const STATUS_COLORS: Record<IncidentStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
  in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
  resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  closed: 'bg-destructive text-destructive-foreground'
};

export default function TaskAssignmentsInput({ 
  teamMembers,
  assignments,
  onAssignmentsChange 
}: TaskAssignmentsInputProps) {
  const [selectedMember, setSelectedMember] = useState<string>('');

  const handleAddAssignment = () => {
    if (!selectedMember) return;

    // Check if already assigned
    if (assignments.some(a => a.person === selectedMember)) {
      return;
    }

    onAssignmentsChange([...assignments, { person: selectedMember, status: 'pending' }]);
    setSelectedMember('');
  };

  const handleRemoveAssignment = (index: number) => {
    onAssignmentsChange(assignments.filter((_, i) => i !== index));
  };

  const handleUpdateStatus = (index: number, status: IncidentStatus) => {
    onAssignmentsChange(
      assignments.map((a, i) => (i === index ? { ...a, status } : a))
    );
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
    member => !assignments.some(a => a.person === member.id)
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
          type="button"
          onClick={handleAddAssignment} 
          disabled={!selectedMember}
          size="sm"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {assignments.map((assignment, index) => {
          const member = teamMembers.find(m => m.id === assignment.person);
          if (!member) return null;

          return (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
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
                onValueChange={(value: IncidentStatus) => handleUpdateStatus(index, value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${STATUS_COLORS[opt.value]} border-transparent text-[10px] px-1 py-0.5`}>
                          {opt.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="outline" className={`${STATUS_COLORS[assignment.status]} border-transparent`}>
                {STATUS_OPTIONS.find(s => s.value === assignment.status)?.label}
              </Badge>

              <Button 
                type="button"
                variant="ghost" 
                size="icon"
                onClick={() => handleRemoveAssignment(index)}
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
