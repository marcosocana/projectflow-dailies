import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { useTaskAssignments } from '@/hooks/useTaskAssignments';
import { updateTaskStatusFromAssignments } from '@/hooks/useSyncTaskStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { formatIncidentReference } from '@/lib/internalTaskIds';
import {
  ASSIGNMENT_STATUS_OPTIONS,
  assignmentToSelectValue,
  getAppStatusTone,
  getIncidentStatusLabel,
  mapIncidentStatusToTaskStatus,
  normalizeEnvironment,
  selectValueToAssignment,
  type AssignmentStatusValue,
  type TaskEnvironment,
} from '@/lib/taskStatus';

type IncidentStatus = Database['public']['Enums']['incident_status'];
type TaskStatus = Database['public']['Enums']['task_status'];
type AssignmentSnapshot = {
  assigned_to: string;
  status: IncidentStatus;
  status_environment?: TaskEnvironment | null;
};

interface TaskAssignmentsManagerProps {
  taskId: string | null;
  teamMembers: Array<{ id: string; name: string; color: string }>;
  onAssignmentsChange?: () => void;
}

const formatManualId = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/\D/g, '').slice(0, 6);

const getTodayDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export default function TaskAssignmentsManager({ 
  taskId, 
  teamMembers,
  onAssignmentsChange 
}: TaskAssignmentsManagerProps) {
  const { assignments, addAssignment, updateAssignmentStatus, removeAssignment } = useTaskAssignments(taskId);
  const [selectedMember, setSelectedMember] = useState<string>('');

  const notifyDailiesChanged = (projectId: string) => {
    window.dispatchEvent(new CustomEvent('dailies-task-created', { detail: { projectId } }));
  };

  const handleAddAssignment = async () => {
    if (!selectedMember || !taskId) return;

    // Check if already assigned
    if (assignments.some(a => a.assigned_to === selectedMember)) {
      return;
    }

    try {
      const memberId = selectedMember;
      await addAssignment(memberId);
      setSelectedMember('');
      
      // Sincronizar el estado general de la tarea
      await updateTaskStatusFromAssignments(taskId);

      const { data: incident } = await supabase
        .from('incidents')
        .select('project_id')
        .eq('id', taskId)
        .maybeSingle();
      
      if (incident?.project_id) notifyDailiesChanged(incident.project_id);
      onAssignmentsChange?.();
    } catch (error) {
      console.error('Error adding assignment:', error);
    }
  };

  const syncDailyTasksForIncident = async (incidentId: string, optimisticAssignments: AssignmentSnapshot[] = []) => {
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('id, project_id, incident_number, name, description, status, additional_comments, environment, status_environment')
      .eq('id', incidentId)
      .maybeSingle();

    if (incidentError || !incident) {
      if (incidentError) throw incidentError;
      return null;
    }

    const { data: assignmentRows, error: assignmentsError } = await supabase
      .from('incident_assignments')
      .select('assigned_to, status, status_environment')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });

    if (assignmentsError) throw assignmentsError;

    const desiredAssignments = [...optimisticAssignments, ...(assignmentRows || [])]
      .filter((assignment) => assignment.assigned_to)
      .reduce<AssignmentSnapshot[]>((acc, assignment) => {
        if (!acc.some((current) => current.assigned_to === assignment.assigned_to)) {
          acc.push({
            assigned_to: assignment.assigned_to,
            status: assignment.status as IncidentStatus,
            status_environment: normalizeEnvironment((assignment as any).status_environment),
          });
        }
        return acc;
      }, []);
    const desiredPersonIds = Array.from(new Set(desiredAssignments.map((assignment) => assignment.assigned_to)));
    const desiredSet = new Set(desiredPersonIds);

    const today = getTodayDate();
    let { data: todayDaily, error: dailyError } = await supabase
      .from('dailies')
      .select('id')
      .eq('project_id', incident.project_id)
      .eq('date', today)
      .maybeSingle();

    if (dailyError) throw dailyError;

    if (!todayDaily) {
      const { data: createdDaily, error: createDailyError } = await supabase
        .from('dailies')
        .insert({ project_id: incident.project_id, date: today, content: {} })
        .select('id')
        .single();

      if (createDailyError) throw createDailyError;
      todayDaily = createdDaily;
    }

    const relatedTicket = formatIncidentReference(incident) || formatManualId(incident.incident_number) || null;

    const { data: linkedTasks, error: linkedTasksError } = await supabase
      .from('tasks')
      .select('id, person_id, assigned_to')
      .eq('project_id', incident.project_id)
      .eq('incident_id', incidentId);

    if (linkedTasksError) throw linkedTasksError;

    const linkedTaskIds = (linkedTasks || []).map((task) => task.id);
    const { data: existingDailyLinks, error: existingDailyLinksError } = linkedTaskIds.length > 0
      ? await supabase
        .from('daily_tasks')
        .select('daily_id, task_id')
        .in('task_id', linkedTaskIds)
      : { data: [], error: null };

    if (existingDailyLinksError) throw existingDailyLinksError;

    const targetDailyIds = Array.from(new Set([
      todayDaily.id,
      ...((existingDailyLinks || []).map((link) => link.daily_id).filter(Boolean)),
    ]));

    const existingTasksByPerson = new Map<string, { id: string }>();
    (linkedTasks || []).forEach((task) => {
      const personId = task.person_id || task.assigned_to;
      if (personId) existingTasksByPerson.set(personId, task);
    });

    const tasksToDelete = (linkedTasks || [])
      .filter((task) => {
        const personId = task.person_id || task.assigned_to;
        return !personId || !desiredSet.has(personId);
      })
      .map((task) => task.id);

    if (tasksToDelete.length > 0) {
      await supabase.from('daily_tasks').delete().in('task_id', tasksToDelete);
      await supabase.from('tasks').delete().in('id', tasksToDelete);
    }

    const { data: maxOrderRows, error: maxOrderError } = await supabase
      .from('daily_tasks')
      .select('daily_id, order_position')
      .in('daily_id', targetDailyIds);

    if (maxOrderError) throw maxOrderError;

    const nextOrderPositionByDaily = new Map<string, number>();
    targetDailyIds.forEach((dailyId) => nextOrderPositionByDaily.set(dailyId, 0));
    (maxOrderRows || []).forEach((row) => {
      const current = nextOrderPositionByDaily.get(row.daily_id) ?? 0;
      const next = (row.order_position ?? -1) + 1;
      if (next > current) nextOrderPositionByDaily.set(row.daily_id, next);
    });

    for (const personId of desiredPersonIds) {
      const assignmentStatus = desiredAssignments.find((assignment) => assignment.assigned_to === personId)?.status || incident.status;
      const assignmentEnvironment = normalizeEnvironment(desiredAssignments.find((assignment) => assignment.assigned_to === personId)?.status_environment)
        || normalizeEnvironment(incident.status_environment);
      const taskStatus = mapIncidentStatusToTaskStatus(assignmentStatus as IncidentStatus);
      const existingTask = existingTasksByPerson.get(personId);
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
            status_environment: taskStatus === 'resolved' ? assignmentEnvironment || 'PRO' : null,
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
            daily_id: todayDaily.id,
            incident_id: incidentId,
            person_id: personId,
            assigned_to: personId,
            status: taskStatus,
            status_environment: taskStatus === 'resolved' ? assignmentEnvironment || 'PRO' : null,
            is_auto_linked: true,
            related_ticket: relatedTicket,
          })
          .select('id')
          .single();

        if (createTaskError) throw createTaskError;
        taskIdToLink = createdTask.id;
      }

      if (taskIdToLink) {
        const { data: existingDailyLinksForTask, error: existingDailyLinkError } = await supabase
          .from('daily_tasks')
          .select('daily_id')
          .eq('task_id', taskIdToLink)
          .in('daily_id', targetDailyIds);

        if (existingDailyLinkError) throw existingDailyLinkError;

        const linkedDailyIds = new Set((existingDailyLinksForTask || []).map((link) => link.daily_id));
        const linksToInsert = targetDailyIds
          .filter((dailyId) => !linkedDailyIds.has(dailyId))
          .map((dailyId) => {
            const orderPosition = nextOrderPositionByDaily.get(dailyId) ?? 0;
            nextOrderPositionByDaily.set(dailyId, orderPosition + 1);
            return {
              daily_id: dailyId,
              task_id: taskIdToLink,
              order_position: orderPosition,
            };
          });

        if (linksToInsert.length > 0) {
          const { error: linkError } = await supabase
            .from('daily_tasks')
            .upsert(linksToInsert, { onConflict: 'daily_id,task_id' });
          if (linkError) throw linkError;
        }
      }
    }

    return incident.project_id;
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await removeAssignment(assignmentId);

      const projectId = taskId ? await syncDailyTasksForIncident(taskId) : null;
      
      // Sincronizar el estado general de la tarea
      if (taskId) {
        await updateTaskStatusFromAssignments(taskId);
      }
      
      if (projectId) notifyDailiesChanged(projectId);
      onAssignmentsChange?.();
    } catch (error) {
      console.error('Error removing assignment:', error);
    }
  };

  const handleUpdateStatus = async (assignmentId: string, value: AssignmentStatusValue) => {
    try {
      const assignment = assignments.find((current) => current.id === assignmentId);
      const { status, environment } = selectValueToAssignment(value);
      await updateAssignmentStatus(assignmentId, status, environment);
      
      // Sincronizar el estado general de la tarea
      if (taskId) {
        await updateTaskStatusFromAssignments(taskId);
      }

      const projectId = taskId ? await syncDailyTasksForIncident(
        taskId,
        assignment?.assigned_to ? [{ assigned_to: assignment.assigned_to, status, status_environment: environment }] : [],
      ) : null;
      if (projectId) notifyDailiesChanged(projectId);
      
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
                value={assignmentToSelectValue(assignment.status, assignment.status_environment)} 
                onValueChange={(value: AssignmentStatusValue) => handleUpdateStatus(assignment.id, value)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${getAppStatusTone(selectValueToAssignment(opt.value).status)} text-[10px] px-1 py-0.5`}>
                          {opt.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="outline" className={`${getAppStatusTone(assignment.status)} border-transparent`}>
                {getIncidentStatusLabel(assignment.status)}
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
