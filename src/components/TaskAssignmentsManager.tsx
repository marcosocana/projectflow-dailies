import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { useTaskAssignments } from '@/hooks/useTaskAssignments';
import { updateTaskStatusFromAssignments } from '@/hooks/useSyncTaskStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];
type TaskStatus = Database['public']['Enums']['task_status'];

interface TaskAssignmentsManagerProps {
  taskId: string | null;
  teamMembers: Array<{ id: string; name: string; color: string }>;
  onAssignmentsChange?: () => void;
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

const formatManualId = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/\D/g, '').slice(0, 6);

const getTodayDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const mapIncidentStatusToTaskStatus = (status: IncidentStatus): TaskStatus => {
  if (status === 'closed' || status === 'resolved') return 'resolved';
  if (status === 'in_progress' || status === 'in_qa') return 'in_progress';
  return 'pending';
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
      const memberId = selectedMember;
      await addAssignment(selectedMember);
      setSelectedMember('');
      await syncDailyTaskForAssignment(taskId, memberId);
      
      // Sincronizar el estado general de la tarea
      await updateTaskStatusFromAssignments(taskId);
      
      onAssignmentsChange?.();
    } catch (error) {
      console.error('Error adding assignment:', error);
    }
  };

  const syncDailyTaskForAssignment = async (incidentId: string, personId: string) => {
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('id, project_id, incident_number, name, description, status')
      .eq('id', incidentId)
      .maybeSingle();

    if (incidentError || !incident) {
      if (incidentError) throw incidentError;
      return;
    }

    const today = getTodayDate();
    let { data: daily, error: dailyError } = await supabase
      .from('dailies')
      .select('id')
      .eq('project_id', incident.project_id)
      .eq('date', today)
      .maybeSingle();

    if (dailyError) throw dailyError;

    if (!daily) {
      const { data: createdDaily, error: createDailyError } = await supabase
        .from('dailies')
        .insert({ project_id: incident.project_id, date: today, content: {} })
        .select('id')
        .single();

      if (createDailyError) throw createDailyError;
      daily = createdDaily;
    }

    const relatedTicket = formatManualId(incident.incident_number) || null;
    const taskStatus = mapIncidentStatusToTaskStatus(incident.status as IncidentStatus);

    const { data: existingTask, error: existingTaskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', incident.project_id)
      .eq('incident_id', incidentId)
      .or(`person_id.eq.${personId},assigned_to.eq.${personId}`)
      .maybeSingle();

    if (existingTaskError) throw existingTaskError;

    let taskIdToLink = existingTask?.id;

    if (taskIdToLink) {
      const { error: updateTaskError } = await supabase
        .from('tasks')
        .update({
          related_ticket: relatedTicket,
          title: incident.name,
          description: incident.description,
          person_id: personId,
          assigned_to: personId,
          status: taskStatus,
          is_auto_linked: true,
        })
        .eq('id', taskIdToLink);

      if (updateTaskError) throw updateTaskError;
    } else {
      const { data: createdTask, error: createTaskError } = await supabase
        .from('tasks')
        .insert({
          title: incident.name,
          description: incident.description,
          project_id: incident.project_id,
          daily_id: daily.id,
          incident_id: incidentId,
          person_id: personId,
          assigned_to: personId,
          status: taskStatus,
          is_auto_linked: true,
          related_ticket: relatedTicket,
        })
        .select('id')
        .single();

      if (createTaskError) throw createTaskError;
      taskIdToLink = createdTask.id;
    }

    if (taskIdToLink) {
      const { error: linkError } = await supabase
        .from('daily_tasks')
        .upsert({
          daily_id: daily.id,
          task_id: taskIdToLink,
        }, {
          onConflict: 'daily_id,task_id',
        });

      if (linkError) throw linkError;
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const assignment = assignments.find((current) => current.id === assignmentId);
      await removeAssignment(assignmentId);

      if (taskId && assignment?.assigned_to) {
        const { data: linkedTasks, error: linkedTasksError } = await supabase
          .from('tasks')
          .select('id')
          .eq('incident_id', taskId)
          .eq('is_auto_linked', true)
          .or(`person_id.eq.${assignment.assigned_to},assigned_to.eq.${assignment.assigned_to}`);

        if (linkedTasksError) throw linkedTasksError;

        const linkedTaskIds = (linkedTasks || []).map((task) => task.id);
        if (linkedTaskIds.length > 0) {
          await supabase.from('daily_tasks').delete().in('task_id', linkedTaskIds);
          await supabase.from('tasks').delete().in('id', linkedTaskIds);
        }
      }
      
      // Sincronizar el estado general de la tarea
      if (taskId) {
        await updateTaskStatusFromAssignments(taskId);
      }
      
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
