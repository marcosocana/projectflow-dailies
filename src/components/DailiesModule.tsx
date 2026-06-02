import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { ProjectButton } from '@/components/ui/project-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import IncidentDetailDialog from '@/components/IncidentDetailDialog';
import { es } from 'date-fns/locale';
import { format, isBefore, isWeekend, startOfDay, isWithinInterval, parseISO } from 'date-fns';
import type { TablesInsert } from '@/integrations/supabase/types';
import { Trash2, Pencil, RefreshCcw, List, ChevronUp, ChevronDown, GripVertical, Link, Copy, AlertTriangle, Asterisk } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  recordAssignmentStatusChange,
  recordDailyTaskCreated,
  recordDailyTasksPersisted,
  recordIncidentCreated,
  recordIncidentStatusChange,
} from '@/lib/incidentActivityLog';
import { INTERNAL_TASK_ID_MARKER, cleanInternalTaskIdMarker, extractInternalTaskNumber, formatIncidentReference, formatInternalTaskIdFromValue, loadNextInternalTaskId } from '@/lib/internalTaskIds';
import {
  ASSIGNMENT_STATUS_OPTIONS,
  assignmentToSelectValue,
  getMinimumIncidentAssignmentState,
  getAppStatusTone,
  getStatusLogLabel,
  getStatusLogValue,
  getTaskStatusLabel as getSharedTaskStatusLabel,
  mapIncidentStatusToTaskStatus,
  mapTaskStatusToIncidentStatus,
  normalizeEnvironment,
  selectValueToAssignment,
  type AssignmentStatusValue,
} from '@/lib/taskStatus';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
type TaskStatus = 'pending' | 'in_progress' | 'resolved' | 'resolved_yesterday' | 'blocked';
type IncidentCategory = 'incident' | 'improvement' | 'corrective_improvement';
type TaskEnvironment = 'DEV' | 'PRE' | 'PRO';
type DailyPersistenceSummary = {
  tasksPersisted: number;
  persistedAt: string;
  sourceDate?: string;
  targetDate?: string;
};
const NOTE_MARKER = '[tipo:nota_seguimiento]';
const CORRECTIVE_CATEGORY_MARKER = '[tipo:mejora_correctiva]';

const getTaskStatusLabel = (status: TaskStatus) => getSharedTaskStatusLabel(status);

const getTaskStatusTone = (status: TaskStatus) => {
  return getAppStatusTone(status);
};

const getTaskCompositeStatusLabel = (status: TaskStatus | string, environment?: string | null) =>
  getStatusLogLabel(getStatusLogValue(status, environment));

const isResolvedTask = (status: TaskStatus) => status === 'resolved' || status === 'resolved_yesterday';
const normalizeTaskEnvironment = (status: TaskStatus, environment: TaskEnvironment | '') => {
  return isResolvedTask(status) ? environment : '';
};

const DAILY_TASK_FORM_STATUS_OPTIONS = ASSIGNMENT_STATUS_OPTIONS.filter(option => option.value !== 'closed');

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const cleanAdditionalComments = (value: string | null | undefined) =>
  cleanInternalTaskIdMarker(String(value ?? '').replace(CORRECTIVE_CATEGORY_MARKER, '')).trim();

const serializeCategory = (category: IncidentCategory, additionalComments: string | null | undefined) => {
  const cleanComments = cleanAdditionalComments(additionalComments);
  const internalMarker = String(additionalComments ?? '').includes(INTERNAL_TASK_ID_MARKER) ? INTERNAL_TASK_ID_MARKER : '';
  if (category === 'corrective_improvement') {
    return {
      category: 'corrective_improvement' as const,
      additional_comments: [CORRECTIVE_CATEGORY_MARKER, internalMarker, cleanComments].filter(Boolean).join('\n'),
    };
  }
  return { category, additional_comments: [internalMarker, cleanComments].filter(Boolean).join('\n') };
};

const dateToLocalInputValue = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const getCurrentTimeLabel = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const getPreviousBusinessDate = (value: Date) => {
  const previous = new Date(value);
  const day = previous.getDay();
  const daysToSubtract = day === 1 ? 3 : day === 0 ? 2 : 1;
  previous.setDate(previous.getDate() - daysToSubtract);
  return previous;
};

const getDailyPersistenceSummary = (content: unknown): DailyPersistenceSummary | null => {
  if (!content || typeof content !== 'object' || !('lastPersistence' in content)) return null;
  const value = (content as { lastPersistence?: unknown }).lastPersistence;
  if (!value || typeof value !== 'object') return null;
  const summary = value as Partial<DailyPersistenceSummary>;
  if (typeof summary.tasksPersisted !== 'number' || typeof summary.persistedAt !== 'string') return null;
  return {
    tasksPersisted: summary.tasksPersisted,
    persistedAt: summary.persistedAt,
    sourceDate: typeof summary.sourceDate === 'string' ? summary.sourceDate : undefined,
    targetDate: typeof summary.targetDate === 'string' ? summary.targetDate : undefined,
  };
};

const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="inline-flex items-center gap-1">
    {children}
    <Asterisk className="h-3 w-3 text-destructive" />
  </Label>
);
interface DailiesModuleProps {
  projectId: string;
  initiallyUnlocked?: boolean;
  enableResolvedYesterday?: boolean;
}
export default function DailiesModule({
  projectId,
  initiallyUnlocked = false,
  enableResolvedYesterday = false
}: DailiesModuleProps) {
  const {
    toast
  } = useToast();
  const {
    accessDailies
  } = useProjectAccess();
  const [unlocked, setUnlocked] = useState<boolean>(initiallyUnlocked);
  const [pass, setPass] = useState('');
  const [teamOpen, setTeamOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const {
    user
  } = useAuth();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    relatedTicket: string;
    description: string;
    personIds: string[];
    incidentId: string;
    epic: string;
    status: TaskStatus;
    environment: TaskEnvironment | '';
    category: IncidentCategory;
  }>({
    title: '',
    relatedTicket: '',
    description: '',
    personIds: [],
    incidentId: '',
    epic: '',
    status: 'pending',
    environment: '',
    category: 'incident'
  });

  // New states for persist modal and view all tasks
  const [persistModalOpen, setPersistModalOpen] = useState(false);
  const [lastDayTasks, setLastDayTasks] = useState<any[]>([]);
  const [selectedTasksForPersist, setSelectedTasksForPersist] = useState<string[]>([]);
  const [persistSourceDate, setPersistSourceDate] = useState<string | null>(null);
  const [viewAllTasksOpen, setViewAllTasksOpen] = useState(false);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<'status' | 'title' | 'person'>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Sorting state for daily tasks
  // Sync when parent unlocks via modal
  useEffect(() => {
    if (initiallyUnlocked) setUnlocked(true);
  }, [initiallyUnlocked]);

  const [date, setDate] = useState<Date>(new Date());
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ projectId?: string }>;
      if (custom.detail?.projectId !== projectId) return;
      preserveScroll();
      loadBaseData();
      loadTasks(date);
    };
    window.addEventListener('dailies-task-created', handler as EventListener);
    return () => window.removeEventListener('dailies-task-created', handler as EventListener);
  }, [projectId, date]);
  const [dailyId, setDailyId] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [dailyPersistenceSummary, setDailyPersistenceSummary] = useState<DailyPersistenceSummary | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [linkedProfiles, setLinkedProfiles] = useState<Record<string, { full_name: string; email: string | null }>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [assignmentStatusesByKey, setAssignmentStatusesByKey] = useState<Record<string, { status: string; status_environment: TaskEnvironment | null }>>({});
  const [incidents, setIncidents] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  // Estado para modal de detalle de incidencia
  const [incidentDetailsOpen, setIncidentDetailsOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState({
    name: '',
    role: '',
    color: '#3B82F6'
  });
  const [taskForm, setTaskForm] = useState<{
    title: string;
    description: string;
    personIds: string[];
    incidentId: string;
    epic: string;
    status: TaskStatus;
    environment: TaskEnvironment | '';
    relatedTicket: string;
    category: IncidentCategory;
  }>({
    title: '',
    description: '',
    personIds: [],
    incidentId: '',
    epic: '',
    status: 'pending',
    environment: '',
    relatedTicket: '',
    category: 'incident'
  });
  
  // New state for task creation mode
  const [creationMode, setCreationMode] = useState<'select' | 'linked' | 'manual'>('select');
  const [incidentSearchQuery, setIncidentSearchQuery] = useState('');
  const [incidentCategoryFilter, setIncidentCategoryFilter] = useState<'all' | IncidentCategory>('all');
  const [manualTaskIdEnabled, setManualTaskIdEnabled] = useState(true);
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({
    comment: '',
    personId: '',
    date: '',
  });
  const loadBaseData = async () => {
    const [{
      data: ppl
    }, {
      data: incs
    }, {
      data: vacs
    }] = await Promise.all([supabase.from('people').select('*').eq('project_id', projectId).order('created_at', {
      ascending: true
    }), supabase.from('incidents').select('id,name,description,incident_number,status,category,epic,additional_comments,environment,status_environment').eq('project_id', projectId).order('incident_number', {
      ascending: false
    }), supabase.from('vacations').select('*').eq('project_id', projectId).order('start_date', {
      ascending: true
    })]);
    setPeople(ppl || []);
    setIncidents(incs || []);
    setVacations(vacs || []);

    const userIds = Array.from(new Set((ppl || []).map((person: any) => person.user_id).filter(Boolean)));
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds as string[]);

      const map = (profileRows || []).reduce((acc: Record<string, { full_name: string; email: string | null }>, profile: any) => {
        acc[profile.user_id] = { full_name: profile.full_name, email: profile.email };
        return acc;
      }, {});
      setLinkedProfiles(map);
    } else {
      setLinkedProfiles({});
    }
  };
  const ensureDaily = async (d: Date) => {
    const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const {
      data,
      error
    } = await supabase.from('dailies').select('*').eq('project_id', projectId).eq('date', isoDate).maybeSingle();
    if (error) throw error;
    if (data) return data.id as string;
    const {
      data: created,
      error: insertErr
    } = await supabase.from('dailies').insert({
      project_id: projectId,
      date: isoDate
    }).select().single();
    if (insertErr) throw insertErr;
    return created.id as string;
  };

  const syncLinkedTaskStatuses = async (taskList: any[]) => {
    try {
      const linkedTasks = taskList.filter((task) => task.incident_id);
      if (linkedTasks.length === 0) return taskList;

      const incidentIds = Array.from(new Set(linkedTasks.map((task) => task.incident_id).filter(Boolean)));
      const linkedAssignments: any[] = [];

      for (const chunk of chunkArray(incidentIds, 75)) {
        const { data: assignmentRows, error: assignmentError } = await supabase
          .from('incident_assignments')
          .select('incident_id,assigned_to,status,status_environment')
          .in('incident_id', chunk);

        if (assignmentError) {
          throw assignmentError;
        }

        linkedAssignments.push(...(assignmentRows || []));
      }

      const assignmentsByIncidentAndPerson = new Map<string, any>();
      (linkedAssignments || []).forEach((assignment: any) => {
        assignmentsByIncidentAndPerson.set(`${assignment.incident_id}:${assignment.assigned_to}`, assignment);
      });
      setAssignmentStatusesByKey(
        (linkedAssignments || []).reduce<Record<string, { status: string; status_environment: TaskEnvironment | null }>>((acc, assignment: any) => {
          acc[`${assignment.incident_id}:${assignment.assigned_to}`] = {
            status: assignment.status,
            status_environment: normalizeEnvironment(assignment.status_environment),
          };
          return acc;
        }, {}),
      );

      const updates: Array<{ id: string; status: TaskStatus; status_environment: TaskEnvironment | null }> = [];
      const staleTaskIds: string[] = [];
      const syncedTasks = taskList.map((task) => {
        if (!task.incident_id) return task;

        const assignedPersonId = task.person_id || task.assigned_to;
        const assignment = assignedPersonId
          ? assignmentsByIncidentAndPerson.get(`${task.incident_id}:${assignedPersonId}`)
          : null;

        if (!assignment) {
          staleTaskIds.push(task.id);
          return null;
        }

        const nextStatus = mapIncidentStatusToTaskStatus(assignment.status) as TaskStatus;
        const nextEnvironment = nextStatus === 'resolved'
          ? normalizeEnvironment(assignment.status_environment) || 'PRO'
          : null;

        if (task.status === nextStatus && normalizeEnvironment(task.status_environment) === nextEnvironment) {
          return task;
        }

        updates.push({ id: task.id, status: nextStatus, status_environment: nextEnvironment });
        return {
          ...task,
          status: nextStatus,
          status_environment: nextEnvironment,
        };
      }).filter(Boolean);

      if (updates.length > 0) {
        await Promise.all(updates.map((update) => supabase
          .from('tasks')
          .update({
            status: update.status,
            status_environment: update.status_environment,
          } as any)
          .eq('id', update.id)));
      }

      if (staleTaskIds.length > 0) {
        await supabase.from('daily_tasks').delete().in('task_id', staleTaskIds);
        await supabase.from('tasks').delete().in('id', staleTaskIds);
      }

      return syncedTasks;
    } catch (error) {
      console.error('Error syncing linked daily task statuses:', error);
      return taskList;
    }
  };

  const loadTasks = async (d: Date) => {
    setTasksLoading(true);
    try {
      const id = await ensureDaily(d);
      setDailyId(id);
      const { data: daily } = await supabase
        .from('dailies')
        .select('content')
        .eq('id', id)
        .maybeSingle();
      setDailyPersistenceSummary(getDailyPersistenceSummary(daily?.content));
      const {
        data: linkRows,
        error
      } = await supabase.from('daily_tasks').select('task_id, order_position').eq('daily_id', id).order('order_position', { ascending: true });
      if (!error) {
        const taskIds = (linkRows || []).map((row: any) => row.task_id).filter(Boolean);
        const taskRows: any[] = [];
        for (const chunk of chunkArray(taskIds, 100)) {
          const { data: chunkTasks, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .in('id', chunk);

          if (taskError) {
            throw taskError;
          }

          taskRows.push(...(chunkTasks || []));
        }

        const tasksById = new Map(taskRows.map((task: any) => [task.id, task]));
        let list = (linkRows || [])
          .map((row: any) => {
            const task = tasksById.get(row.task_id);
            return task ? { ...task, order_position: row.order_position } : null;
          })
          .filter(Boolean);

      if (dateToLocalInputValue(d) === dateToLocalInputValue(new Date())) {
        const { data: teamRows } = await supabase
          .from('people')
          .select('id')
          .eq('project_id', projectId);
        const teamPersonIds = new Set((teamRows || []).map((person: any) => person.id).filter(Boolean));

        if (teamPersonIds.size > 0) {
          const { data: assignedTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId);

          const existingTasksByIncidentPerson = new Map<string, any>();
          (assignedTasks || []).forEach((task: any) => {
            const personId = task.person_id || task.assigned_to;
            if (task.incident_id && personId && !existingTasksByIncidentPerson.has(`${task.incident_id}:${personId}`)) {
              existingTasksByIncidentPerson.set(`${task.incident_id}:${personId}`, task);
            }
          });

          const { data: homeIncidents } = await supabase
            .from('incidents')
            .select('id,name,description,project_id,incident_number,category,additional_comments,status,status_environment,assigned_to')
            .eq('project_id', projectId);
          const { data: homeAssignments } = await supabase
            .from('incident_assignments')
            .select('incident_id,assigned_to,status,status_environment')
            .in('assigned_to', Array.from(teamPersonIds));

          const incidentsById = new Map((homeIncidents || []).map((incident: any) => [incident.id, incident]));
          const desiredIncidentAssignments = new Map<string, any>();
          (homeAssignments || []).forEach((assignment: any) => {
            const incident = incidentsById.get(assignment.incident_id);
            if (incident && teamPersonIds.has(assignment.assigned_to)) {
              desiredIncidentAssignments.set(`${assignment.incident_id}:${assignment.assigned_to}`, {
                incident,
                personId: assignment.assigned_to,
                status: assignment.status,
                status_environment: assignment.status_environment,
              });
            }
          });

          const tasksToInsert = Array.from(desiredIncidentAssignments.values())
            .filter(({ incident, personId }) => !existingTasksByIncidentPerson.has(`${incident.id}:${personId}`))
            .map(({ incident, personId, status, status_environment }) => {
              const taskStatus = mapIncidentStatusToTaskStatus(status) as TaskStatus;
              const taskEnvironment = taskStatus === 'resolved'
                ? normalizeEnvironment(status_environment) || 'PRO'
                : null;
              return {
                title: incident.name,
                description: incident.description || null,
                project_id: projectId,
                daily_id: id,
                incident_id: incident.id,
                person_id: personId,
                assigned_to: personId,
                status: taskStatus,
                status_environment: taskEnvironment,
                is_auto_linked: true,
                related_ticket: formatIncidentReference(incident),
              };
            });

          let createdIncidentTasks: any[] = [];
          if (tasksToInsert.length > 0) {
            const { data: insertedTasks } = await supabase
              .from('tasks')
              .insert(tasksToInsert as any)
              .select('*');
            createdIncidentTasks = insertedTasks || [];
          }

          const allAssignedTasks = [...(assignedTasks || []), ...createdIncidentTasks];
          const linkedTaskIds = new Set(list.map((task: any) => task.id));
          const desiredTaskIds = new Set(Array.from(desiredIncidentAssignments.values()).map(({ incident, personId }) => {
            const existingTask = allAssignedTasks.find((task: any) => task.incident_id === incident.id && (task.person_id || task.assigned_to) === personId);
            return existingTask?.id;
          }).filter(Boolean));
          const missingAssignedTasks = allAssignedTasks
            .filter((task: any) => teamPersonIds.has(task.person_id || task.assigned_to))
            .filter((task: any) => desiredTaskIds.has(task.id) || !task.incident_id)
            .filter((task: any) => !linkedTaskIds.has(task.id));

          if (missingAssignedTasks.length > 0) {
            const currentMaxOrder = Math.max(
              -1,
              ...list.map((task: any) => Number(task.order_position ?? -1)),
            );
            const restoredLinks = missingAssignedTasks.map((task: any, index: number) => ({
              daily_id: id,
              task_id: task.id,
              order_position: currentMaxOrder + index + 1,
            }));

            await supabase
              .from('daily_tasks')
              .upsert(restoredLinks as any, { onConflict: 'daily_id,task_id' } as any);

            list = [
              ...list,
              ...missingAssignedTasks.map((task: any, index: number) => ({
                ...task,
                order_position: currentMaxOrder + index + 1,
              })),
            ];
          }
        }
      }

        const syncedList = await syncLinkedTaskStatuses(list);
        setTasks(syncedList);
      }
    } finally {
      setTasksLoading(false);
    }
  };
  useEffect(() => {
    if (unlocked) {
      loadBaseData();
      loadTasks(date);
    }
  }, [unlocked, projectId, date]);
  const onUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await accessDailies(projectId, pass);
      setUnlocked(true);
    } catch {}
  };
  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      error
    } = await supabase.from('people').insert({
      name: personForm.name,
      role: personForm.role,
      color: personForm.color,
      project_id: projectId
    });
    if (error) return toast({
      title: 'Error',
      description: 'No se pudo crear la persona',
      variant: 'destructive'
    });
    setPersonForm({
      name: '',
      role: '',
      color: '#3B82F6'
    });
    loadBaseData();
  };
  const deletePerson = async (id: string) => {
    const {
      error
    } = await supabase.from('people').delete().eq('id', id);
    if (error) return toast({
      title: 'Error',
      description: 'No se pudo eliminar la persona',
      variant: 'destructive'
    });
    loadBaseData();
  };
  const handleIncidentSelect = (incidentId: string) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (incident) {
      setManualTaskIdEnabled(true);
      setTaskForm({
        title: incident.name || '',
        description: incident.description || '',
        personIds: [],
        incidentId: incident.id,
        epic: incident.epic || '',
        status: incident.status === 'resolved' ? 'resolved' : incident.status === 'in_progress' ? 'in_progress' : incident.status === 'blocked' ? 'blocked' : 'pending',
        environment: incident.status === 'resolved' ? (incident.status_environment || '') : '',
        relatedTicket: formatIncidentReference(incident) || '',
        category: getDisplayCategory(incident) || 'incident'
      });
      setCreationMode('linked');
    }
  };

  const openHomeCreateTaskModal = () => {
    setCreateTaskOpen(false);
    setCreationMode('select');
    window.dispatchEvent(new CustomEvent('open-home-create-task-modal'));
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyId) return;
    let relatedTicket = taskForm.relatedTicket.trim();
    if (manualTaskIdEnabled) {
      relatedTicket = formatTaskManualId(relatedTicket);
      if (!relatedTicket) {
        return toast({
          title: 'ID obligatorio',
          description: 'Completa el ID de la tarea con un número de hasta 6 dígitos.',
          variant: 'destructive'
        });
      }
    } else if (!relatedTicket) {
      relatedTicket = await loadNextAutoTaskId();
      setTaskForm(f => ({ ...f, relatedTicket }));
    }
    if (!manualTaskIdEnabled) {
      relatedTicket = formatInternalTaskIdFromValue(relatedTicket);
      setTaskForm(f => ({ ...f, relatedTicket }));
    }

    if (!relatedTicket) {
      return toast({
        title: 'ID obligatorio',
        description: 'No se pudo generar el ID automático.',
        variant: 'destructive'
      });
    }
    if (isResolvedTask(taskForm.status) && !taskForm.environment) {
      return toast({
        title: 'Entorno obligatorio',
        description: 'Selecciona DEV, PRE o PRO para las tareas resueltas.',
        variant: 'destructive',
      });
    }
    let incidentIdToLink = taskForm.incidentId || null;
    const taskEnvironment = normalizeTaskEnvironment(taskForm.status, taskForm.environment);
    const selectedPersonIds = Array.from(new Set(taskForm.personIds.filter(Boolean)));

    if (creationMode === 'manual') {
      const newIncidentId = crypto.randomUUID();
      const incidentNumber = manualTaskIdEnabled ? Number(relatedTicket) : Number(relatedTicket.replace(/^INT/i, ''));
      const { error: incidentError } = await supabase.from('incidents').insert({
        id: newIncidentId,
        incident_number: incidentNumber,
        name: taskForm.title,
        description: taskForm.description || null,
        status_environment: taskEnvironment || null,
        device: '',
        occurred_at: date.toISOString(),
        status: mapTaskStatusToIncidentStatus(taskForm.status),
        category: taskForm.category,
        epic: taskForm.epic || null,
        additional_comments: [
          '[origen:seguimiento_diario]',
          !manualTaskIdEnabled ? INTERNAL_TASK_ID_MARKER : '',
        ].filter(Boolean).join('\n'),
        project_id: projectId,
        created_by: user?.id ?? null,
        assigned_to: selectedPersonIds.length > 0 ? selectedPersonIds[0] : null,
      } as any);

      if (incidentError) {
        const isDuplicateId = incidentError.code === '23505' && String(incidentError.message || '').includes('incident_number');
        return toast({
          title: 'Error',
          description: isDuplicateId
            ? 'Ya existe una tarea con ese ID en este proyecto. Usa otro ID.'
            : 'No se pudo crear la tarea en Home',
          variant: 'destructive',
        });
      }

      incidentIdToLink = newIncidentId;

      await recordIncidentCreated({
        projectId,
        incidentId: newIncidentId,
        incidentNumber,
	        incidentName: taskForm.title,
	        incidentCategory: taskForm.category,
	        toStatus: mapTaskStatusToIncidentStatus(taskForm.status),
	        toEnvironment: taskEnvironment || null,
	      });

    }

    const primaryPersonId = selectedPersonIds[0] || null;

    const payload: TablesInsert<'tasks'> = {
      title: taskForm.title,
      description: taskForm.description || null,
      project_id: projectId,
      daily_id: dailyId,
      person_id: primaryPersonId,
      assigned_to: primaryPersonId,
      incident_id: incidentIdToLink,
      status: taskForm.status ?? 'pending',
      status_environment: taskEnvironment || null,
      is_auto_linked: creationMode === 'linked' || creationMode === 'manual',
      related_ticket: relatedTicket
    };
    const {
      data: created,
      error
    } = await supabase.from('tasks').insert(payload).select().single();
    if (error || !created) return toast({
      title: 'Error',
      description: 'No se pudo crear la tarea',
      variant: 'destructive'
    });
    
    // If automatically linked to incident, sync status
    if (incidentIdToLink && creationMode === 'linked') {
      const { data: currentIncident } = await supabase
        .from('incidents')
        .select('status, incident_number, name, category, status_environment')
        .eq('id', incidentIdToLink)
        .maybeSingle();

      await supabase
        .from('incidents')
        .update({
          status: mapTaskStatusToIncidentStatus(taskForm.status),
          epic: taskForm.epic || null,
          status_environment: taskEnvironment || null,
          assigned_to: primaryPersonId,
        } as any)
        .eq('id', incidentIdToLink);

      if (
        currentIncident &&
        (currentIncident.status !== mapTaskStatusToIncidentStatus(taskForm.status) ||
          normalizeTaskEnvironment(mapIncidentStatusToTaskStatus(currentIncident.status) as TaskStatus, currentIncident.status_environment || '') !== taskEnvironment)
      ) {
        await recordIncidentStatusChange({
          projectId,
          incidentId: incidentIdToLink,
          incidentNumber: Number(currentIncident.incident_number),
          incidentName: currentIncident.name,
          incidentCategory: currentIncident.category,
          fromStatus: currentIncident.status,
          toStatus: mapTaskStatusToIncidentStatus(taskForm.status),
          fromEnvironment: currentIncident.status_environment,
          toEnvironment: taskEnvironment || null,
        });
      }
      
    }
    
    // Get the current max order_position for this daily
    const { data: existingTasks } = await supabase
      .from('daily_tasks')
      .select('order_position')
      .eq('daily_id', dailyId)
      .order('order_position', { ascending: false })
      .limit(1);
    
    const nextPosition = existingTasks && existingTasks.length > 0 
      ? (existingTasks[0].order_position || 0) + 1 
      : 0;
    
    const additionalCreatedIds: string[] = [];
    const additionalPersonIds = selectedPersonIds.slice(1);
    if (additionalPersonIds.length > 0) {
      const { data: additionalTasks, error: additionalError } = await supabase
        .from('tasks')
        .insert(additionalPersonIds.map(personId => ({
          title: taskForm.title,
          description: taskForm.description || null,
          project_id: projectId,
          daily_id: dailyId,
          person_id: personId,
          assigned_to: personId,
          incident_id: incidentIdToLink,
          status: taskForm.status ?? 'pending',
          status_environment: taskEnvironment || null,
          is_auto_linked: creationMode === 'linked' || creationMode === 'manual',
          related_ticket: relatedTicket,
        })) as any)
        .select('id');

      if (additionalError) {
        return toast({
          title: 'Error',
          description: 'La tarea se creó, pero no se pudieron crear todas las asignaciones en Seguimiento diario',
          variant: 'destructive',
        });
      }

      additionalCreatedIds.push(...((additionalTasks || []).map((task: any) => task.id).filter(Boolean)));
    }

    const taskIdsToLink = [created.id, ...additionalCreatedIds];
    await supabase.from('daily_tasks').upsert(taskIdsToLink.map((taskId, index) => ({
      daily_id: dailyId,
      task_id: taskId,
      order_position: nextPosition + index
    })) as any, {
      onConflict: 'daily_id,task_id'
    } as any);

    if (incidentIdToLink && selectedPersonIds.length > 0 && (creationMode === 'linked' || creationMode === 'manual')) {
      const { data: existingAssignments } = await supabase
        .from('incident_assignments')
        .select('assigned_to')
        .eq('incident_id', incidentIdToLink)
        .in('assigned_to', selectedPersonIds);
      const existingPersonIds = new Set((existingAssignments || []).map((assignment: any) => assignment.assigned_to));
      const missingPersonIds = selectedPersonIds.filter(personId => !existingPersonIds.has(personId));

      if (missingPersonIds.length > 0) {
        await supabase
          .from('incident_assignments')
          .insert(missingPersonIds.map(personId => ({
            incident_id: incidentIdToLink,
            assigned_to: personId,
            status: mapTaskStatusToIncidentStatus(taskForm.status),
          })) as any);
      }
    }

    await recordDailyTaskCreated({
      projectId,
      taskId: created.id,
      title: taskForm.title,
      relatedTicket,
      taskCount: taskIdsToLink.length,
    });
    setTaskForm({
      title: '',
      description: '',
      personIds: [],
      incidentId: '',
      status: 'pending',
      environment: '',
      relatedTicket: '',
      epic: '',
      category: 'incident'
    });
    setManualTaskIdEnabled(true);
    setCreationMode('select');
    setIncidentSearchQuery('');
    setIncidentCategoryFilter('all');
    setCreateTaskOpen(false);
    preserveScroll();
    loadTasks(date);
    loadBaseData(); // Reload to get updated incident status
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDate = noteForm.date ? new Date(`${noteForm.date}T00:00:00`) : date;
    const targetDailyId = await ensureDaily(targetDate);
    const comment = noteForm.comment.trim();
    if (!comment || !noteForm.personId) {
      return toast({
        title: 'Campos obligatorios',
        description: 'Completa el comentario y la persona asignada.',
        variant: 'destructive',
      });
    }

    const { data: createdNote, error } = await supabase.from('tasks').insert({
      title: comment,
      description: NOTE_MARKER,
      project_id: projectId,
      daily_id: targetDailyId,
      person_id: noteForm.personId,
      assigned_to: noteForm.personId,
      status: 'pending',
      is_auto_linked: false,
      related_ticket: null,
    }).select().single();

    if (error || !createdNote) {
      return toast({
        title: 'Error',
        description: 'No se pudo crear la nota',
        variant: 'destructive',
      });
    }

    const { data: maxOrderData } = await supabase
      .from('daily_tasks')
      .select('order_position')
      .eq('daily_id', targetDailyId)
      .order('order_position', { ascending: false })
      .limit(1);

    const nextPosition = maxOrderData && maxOrderData.length > 0
      ? (maxOrderData[0].order_position || 0) + 1
      : 0;

    const { error: linkError } = await supabase.from('daily_tasks').upsert({
      daily_id: targetDailyId,
      task_id: createdNote.id,
      order_position: nextPosition,
    } as any, {
      onConflict: 'daily_id,task_id',
    } as any);

    if (linkError) {
      return toast({
        title: 'Error',
        description: 'La nota se creó pero no se pudo vincular al día seleccionado',
        variant: 'destructive',
      });
    }

    setNoteOpen(false);
    setNoteForm({ comment: '', personId: '', date: dateToLocalInputValue(date) });
    if (dateToLocalInputValue(targetDate) === dateToLocalInputValue(date)) {
      loadTasks(date);
    }
  };

  const toggleTask = async (task: any) => {
    preserveScroll();
    const {
      error
    } = await supabase.from('tasks').update({
      is_completed: !task.is_completed
    }).eq('id', task.id);
    if (!error) setTasks(t => t.map(x => x.id === task.id ? {
      ...x,
      is_completed: !x.is_completed
    } : x));
  };

  const toggleUrgent = async (taskId: string, currentUrgent: boolean) => {
    preserveScroll();
    const nextUrgent = !currentUrgent;
    const nextTasks = nextUrgent
      ? [
          ...(tasks.find((task) => task.id === taskId) ? [{
            ...tasks.find((task) => task.id === taskId),
            is_urgent: true,
          }] : []),
          ...tasks
            .filter((task) => task.id !== taskId)
            .map((task) => task.id === taskId ? { ...task, is_urgent: true } : task),
        ].map((task, index) => ({ ...task, order_position: index }))
      : tasks.map((task) => task.id === taskId ? { ...task, is_urgent: false } : task);

    const { error } = await supabase.from('tasks').update({
      is_urgent: nextUrgent,
    }).eq('id', taskId);

    if (error) return;

    if (nextUrgent && dailyId) {
      const { error: orderError } = await supabase
        .from('daily_tasks')
        .upsert(
          nextTasks.map((task) => ({
            daily_id: dailyId,
            task_id: task.id,
            order_position: task.order_position ?? 0,
          })),
          { onConflict: 'daily_id,task_id' },
        );

      if (orderError) {
        return toast({
          title: 'Error',
          description: 'No se pudo fijar la tarea',
          variant: 'destructive',
        });
      }
    }

    setTasks(nextTasks);
  };

  const updateTaskEnvironment = async (task: any, environment: TaskEnvironment) => {
    if (!isResolvedTask(task.status as TaskStatus)) return;
    preserveScroll();
    const { error } = await supabase
      .from('tasks')
      .update({ status_environment: environment })
      .eq('id', task.id);

    if (error) {
      return toast({
        title: 'Error',
        description: 'No se pudo actualizar el entorno',
        variant: 'destructive',
      });
    }

    if (task.incident_id) {
      const linkedIncident = incidents.find((incident) => incident.id === task.incident_id);
      await supabase
        .from('incidents')
        .update({ status_environment: environment })
        .eq('id', task.incident_id);
      if (linkedIncident && normalizeTaskEnvironment(task.status as TaskStatus, linkedIncident.status_environment || '') !== environment) {
        await recordIncidentStatusChange({
          projectId,
          incidentId: task.incident_id,
          incidentNumber: Number(linkedIncident.incident_number),
          incidentName: linkedIncident.name,
          incidentCategory: linkedIncident.category,
          fromStatus: linkedIncident.status,
          toStatus: linkedIncident.status,
          fromEnvironment: linkedIncident.status_environment,
          toEnvironment: environment,
        });
      }
      setIncidents(prev => prev.map(incident => incident.id === task.incident_id ? { ...incident, status_environment: environment } : incident));
    }

    setTasks(prev => prev.map(item => item.id === task.id ? { ...item, status_environment: environment } : item));
    setSelectedTask(prev => prev?.id === task.id ? { ...prev, status_environment: environment } : prev);
  };

  const updateTaskStatus = async (task: any, value: AssignmentStatusValue) => {
    preserveScroll();
    const next = selectValueToAssignment(value);
    const nextTaskStatus = mapIncidentStatusToTaskStatus(next.status) as TaskStatus;
    const nextEnvironment = nextTaskStatus === 'resolved' ? next.environment || 'PRO' : null;

    const { error } = await supabase
      .from('tasks')
      .update({
        status: nextTaskStatus,
        status_environment: nextEnvironment,
      } as any)
      .eq('id', task.id);

    if (error) {
      return toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    }

    if (task.incident_id) {
      const linkedIncident = incidents.find((incident) => incident.id === task.incident_id);
      const assignedPerson = people.find((candidate) => candidate.id === (task.person_id || task.assigned_to));
      const assignedPersonId = task.person_id || task.assigned_to;
      let nextIncidentStatus = linkedIncident?.status || mapTaskStatusToIncidentStatus(nextTaskStatus);
      let nextIncidentEnvironment = linkedIncident?.status_environment || null;

      if (assignedPersonId) {
        const { data: previousAssignment } = await supabase
          .from('incident_assignments')
          .select('status, status_environment')
          .eq('incident_id', task.incident_id)
          .eq('assigned_to', assignedPersonId)
          .maybeSingle();

        await supabase
          .from('incident_assignments')
          .update({
            status: next.status,
            status_environment: nextEnvironment,
          } as any)
          .eq('incident_id', task.incident_id)
          .eq('assigned_to', assignedPersonId);

        if (
          linkedIncident &&
          previousAssignment &&
          (
            previousAssignment.status !== next.status ||
            normalizeEnvironment(previousAssignment.status_environment) !== normalizeEnvironment(nextEnvironment)
          )
        ) {
          await recordAssignmentStatusChange({
            projectId,
            incidentId: task.incident_id,
            incidentNumber: Number(linkedIncident.incident_number),
            incidentName: linkedIncident.name,
            incidentCategory: linkedIncident.category,
            personName: assignedPerson?.name || 'Persona asignada',
            fromStatus: previousAssignment.status,
            toStatus: next.status,
            fromEnvironment: previousAssignment.status_environment,
            toEnvironment: nextEnvironment,
          });
        }

        setAssignmentStatusesByKey((prev) => ({
          ...prev,
          [`${task.incident_id}:${assignedPersonId}`]: {
            status: next.status,
            status_environment: nextEnvironment,
          },
        }));
      }

      const { data: allAssignments } = await supabase
        .from('incident_assignments')
        .select('status, status_environment')
        .eq('incident_id', task.incident_id);

      if (allAssignments && allAssignments.length > 0) {
        const nextState = getMinimumIncidentAssignmentState(allAssignments);
        nextIncidentStatus = nextState.status;
        nextIncidentEnvironment = nextState.statusEnvironment;
      }

      await supabase
        .from('incidents')
        .update({
          status: nextIncidentStatus,
          status_environment: nextIncidentEnvironment,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', task.incident_id);

      if (
        linkedIncident &&
        (
          linkedIncident.status !== nextIncidentStatus ||
          normalizeEnvironment(linkedIncident.status_environment) !== normalizeEnvironment(nextIncidentEnvironment)
        )
      ) {
        await recordIncidentStatusChange({
          projectId,
          incidentId: task.incident_id,
          incidentNumber: Number(linkedIncident.incident_number),
          incidentName: linkedIncident.name,
          incidentCategory: linkedIncident.category,
          fromStatus: linkedIncident.status,
          toStatus: nextIncidentStatus,
          fromEnvironment: linkedIncident.status_environment,
          toEnvironment: nextIncidentEnvironment,
        });
      }

      setIncidents(prev => prev.map(incident => incident.id === task.incident_id ? {
        ...incident,
        status: nextIncidentStatus,
        status_environment: nextIncidentEnvironment,
      } : incident));
    }

    setTasks(prev => prev.map(item => item.id === task.id ? {
      ...item,
      status: nextTaskStatus,
      status_environment: nextEnvironment,
    } : item));
    setSelectedTask(prev => prev?.id === task.id ? {
      ...prev,
      status: nextTaskStatus,
      status_environment: nextEnvironment,
    } : prev);
  };

  const updateSelectedTaskStatus = (value: AssignmentStatusValue) => {
    const next = selectValueToAssignment(value);
    const nextStatus = mapIncidentStatusToTaskStatus(next.status) as TaskStatus;
    const nextEnvironment = nextStatus === 'resolved' ? next.environment || 'PRO' : null;

    setEditForm(f => ({
      ...f,
      status: nextStatus,
      environment: nextEnvironment || '',
    }));

    if (selectedTask) {
      void updateTaskStatus({
        ...selectedTask,
        incident_id: editForm.incidentId || selectedTask.incident_id,
        person_id: editForm.personIds[0] || selectedTask.person_id,
        assigned_to: editForm.personIds[0] || selectedTask.assigned_to,
      }, value);
    }
  };

  const deleteTask = async (taskOrId: any) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    preserveScroll();
    const task = typeof taskOrId === 'string'
      ? tasks.find((candidate) => candidate.id === taskOrId)
      : taskOrId;
    const id = typeof taskOrId === 'string' ? taskOrId : taskOrId?.id;
    if (!id) return;

    if (task?.incident_id && task?.person_id) {
      await supabase
        .from('incident_assignments')
        .delete()
        .eq('incident_id', task.incident_id)
        .eq('assigned_to', task.person_id);

      const { data: remainingAssignments } = await supabase
        .from('incident_assignments')
        .select('assigned_to')
        .eq('incident_id', task.incident_id)
        .limit(1);

      const fallbackAssignedTo = remainingAssignments && remainingAssignments.length > 0
        ? remainingAssignments[0].assigned_to
        : null;

      await supabase
        .from('incidents')
        .update({ assigned_to: fallbackAssignedTo })
        .eq('id', task.incident_id);
    }

    const {
      error
    } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setTasks(t => t.filter(x => x.id !== id));
    }
  };
  const openPersistModal = async () => {
    try {
      if (!date) return;
      const sourceDate = dateToLocalInputValue(getPreviousBusinessDate(date));

      const { data: sourceDaily } = await supabase
        .from('dailies')
        .select('id, date')
        .eq('project_id', projectId)
        .eq('date', sourceDate)
        .maybeSingle();

      if (!sourceDaily) {
        toast({
          title: 'Sin tareas previas',
          description: `No se encontraron tareas para el día laborable anterior (${sourceDate}).`
        });
        return;
      }

      // Get tasks from the last day with tasks with their order
      const {
        data: taskData
      } = await supabase
        .from('daily_tasks')
        .select('tasks(*), order_position')
        .eq('daily_id', sourceDaily.id)
        .order('order_position');
      
      const tasksWithOrder = (taskData || [])
        .filter((r: any) => r.tasks)
        .map((r: any) => ({
          ...r.tasks,
          original_order: r.order_position
        }));
      const syncedTasksWithOrder = await syncLinkedTaskStatuses(tasksWithOrder);
      
      setLastDayTasks(syncedTasksWithOrder);
      setSelectedTasksForPersist(syncedTasksWithOrder.filter((t: any) => !isResolvedTask(t.status as TaskStatus)).map((t: any) => t.id));
      setPersistSourceDate(sourceDaily.date);
      setPersistModalOpen(true);
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las tareas del día anterior',
        variant: 'destructive'
      });
    }
  };
  const persistSelectedTasks = async () => {
    preserveScroll();
    try {
      if (!date) return;
      const todayId = await ensureDaily(date);

      // Avoid duplicates: fetch existing links for selected tasks
      const { data: existingLinks, error: existingErr } = await supabase
        .from('daily_tasks')
        .select('task_id')
        .eq('daily_id', todayId)
        .in('task_id', selectedTasksForPersist);

      if (existingErr) throw existingErr;

      const existingIds = (existingLinks || []).map((r: any) => r.task_id);
      
      // Get current max order_position for today
      const { data: maxOrderData } = await supabase
        .from('daily_tasks')
        .select('order_position')
        .eq('daily_id', todayId)
        .order('order_position', { ascending: false })
        .limit(1);
      
      const startPosition = maxOrderData && maxOrderData.length > 0 
        ? (maxOrderData[0].order_position || 0) + 1 
        : 0;
      
      // Sort selected tasks by their original order before assigning new positions
      const persistableSelectedTaskIds = selectedTasksForPersist.filter(taskId => {
        const task = lastDayTasks.find((t: any) => t.id === taskId);
        return task && !isResolvedTask(task.status as TaskStatus);
      });

      const tasksWithOriginalOrder = persistableSelectedTaskIds
        .filter((taskId) => !existingIds.includes(taskId))
        .map(taskId => {
          const task = lastDayTasks.find((t: any) => t.id === taskId);
          return {
            taskId,
            originalOrder: task?.original_order ?? 999999
          };
        })
        .sort((a, b) => a.originalOrder - b.originalOrder);
      
      const rows = tasksWithOriginalOrder.map((item, index) => ({ 
        daily_id: todayId, 
        task_id: item.taskId,
        order_position: startPosition + index
      }));

      if (rows.length) {
        const { error: insertErr } = await supabase.from('daily_tasks').insert(rows as any);
        if (insertErr) throw insertErr;
        
      }

      const persistedAt = getCurrentTimeLabel();
      const targetDate = dateToLocalInputValue(date);
      const sourceDate = persistSourceDate || dateToLocalInputValue(getPreviousBusinessDate(date));
      const persistenceSummary = {
        tasksPersisted: rows.length,
        persistedAt,
        sourceDate,
        targetDate,
      };

      const { data: currentDaily } = await supabase
        .from('dailies')
        .select('content')
        .eq('id', todayId)
        .maybeSingle();
      const currentContent = currentDaily?.content && typeof currentDaily.content === 'object'
        ? currentDaily.content
        : {};

      await supabase
        .from('dailies')
        .update({
          content: {
            ...(currentContent as Record<string, unknown>),
            lastPersistence: persistenceSummary,
          },
        })
        .eq('id', todayId);

      await recordDailyTasksPersisted({
        projectId,
        ...persistenceSummary,
      });

      await loadTasks(date);
      setPersistModalOpen(false);
      toast({
        title: 'Tareas persistidas',
        description: rows.length
          ? `Se persistieron ${rows.length} tareas.`
          : 'No había tareas nuevas para persistir.',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudieron persistir las tareas',
        variant: 'destructive',
      });
    }
  };
  const loadAllTasks = async () => {
    try {
      const {
        data: tasksData
      } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', {
        ascending: false
      });
      if (tasksData) {
        // Remove duplicates based on task ID
        const uniqueTasks = tasksData.filter((task, index, self) => index === self.findIndex(t => t.id === task.id));

        // Sort by default: in_progress, pending, resolved
        uniqueTasks.sort((a, b) => {
          const statusOrder = {
            'in_progress': 0,
            'pending': 1,
            'blocked': 2,
            'resolved': 3
          };
          const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
          const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
          return aOrder - bOrder;
        });
        setAllTasks(uniqueTasks);
        setFilteredTasks(uniqueTasks);
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar todas las tareas',
        variant: 'destructive'
      });
    }
  };

  // Filter, search and sort logic for all tasks view
  useEffect(() => {
    let filtered = [...allTasks];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.related_ticket?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'status':
          const statusOrder = { 'in_progress': 0, 'pending': 1, 'blocked': 2, 'resolved': 3 };
          aValue = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
          bValue = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
          break;
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'person':
          const aPerson = people.find(p => p.id === a.person_id);
          const bPerson = people.find(p => p.id === b.person_id);
          aValue = aPerson?.name?.toLowerCase() || 'z'; // Put unassigned at the end
          bValue = bPerson?.name?.toLowerCase() || 'z';
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredTasks(filtered);
  }, [allTasks, statusFilter, searchQuery, sortField, sortDirection, people]);

  const handleSort = (field: 'status' | 'title' | 'person') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const activeDailyTasks = useMemo(() => {
    return tasks;
  }, [tasks]);

  const visibleDailyTasks = useMemo(() => {
    return selectedPersonFilter === 'all'
      ? activeDailyTasks
      : activeDailyTasks.filter(task => (task.person_id || task.assigned_to || 'unassigned') === selectedPersonFilter);
  }, [activeDailyTasks, selectedPersonFilter]);

  const statusOrder: Record<TaskStatus, number> = {
    in_progress: 0,
    pending: 1,
    blocked: 2,
    resolved: 3,
    resolved_yesterday: 3,
  };

  const getDisplayedAssignmentStatus = (task: { incident_id?: string | null; person_id?: string | null; assigned_to?: string | null; status: TaskStatus; status_environment?: TaskEnvironment | null }) => {
    const assignmentKey = task.incident_id && (task.person_id || task.assigned_to)
      ? `${task.incident_id}:${task.person_id || task.assigned_to}`
      : null;
    const assignmentStatus = assignmentKey ? assignmentStatusesByKey[assignmentKey] : null;

    return {
      status: (assignmentStatus?.status ? mapIncidentStatusToTaskStatus(assignmentStatus.status) : task.status) as TaskStatus,
      status_environment: assignmentStatus?.status_environment ?? task.status_environment ?? null,
    };
  };

  const getDailyStatusGroup = (task: { incident_id?: string | null; person_id?: string | null; assigned_to?: string | null; status: TaskStatus; status_environment?: TaskEnvironment | null }) => {
    const displayedStatus = getDisplayedAssignmentStatus(task);

    if (displayedStatus.status === 'resolved' || displayedStatus.status === 'resolved_yesterday') {
      const environment = normalizeEnvironment(displayedStatus.status_environment) || 'PRO';
      const resolvedEnvironmentOrder: Record<TaskEnvironment, number> = {
        DEV: 0,
        PRE: 1,
        PRO: 2,
      };

      return `resolved_${resolvedEnvironmentOrder[environment]}`;
    }

    return String(statusOrder[displayedStatus.status] ?? 99);
  };

  // Daily list is always sorted by status groups: WIP, Pending, Block, Resolved DEV/PRE/PRO.
  const sortedTasks = useMemo(() => {
    return [...visibleDailyTasks].sort((a, b) => {
      if (Boolean(a.is_urgent) !== Boolean(b.is_urgent)) {
        return a.is_urgent ? -1 : 1;
      }
      if (a.is_urgent && b.is_urgent) {
        return (a.order_position ?? 0) - (b.order_position ?? 0);
      }

      const aGroup = getDailyStatusGroup(a);
      const bGroup = getDailyStatusGroup(b);
      const byStatus = aGroup.localeCompare(bGroup, undefined, { numeric: true });
      if (byStatus !== 0) return byStatus;
      return (a.order_position ?? 0) - (b.order_position ?? 0);
    });
  }, [visibleDailyTasks]);

  const copyDailySummary = async () => {
    const getSummaryTaskType = (task: any) => {
      const ticket = String(task.related_ticket ?? '').trim();
      const linkedIncident = incidents.find((incident) => {
        const incidentReference = formatIncidentReference(incident);
        return incidentReference === ticket || String(incident.incident_number ?? '') === ticket;
      });

      return getCategoryLabel(getDisplayCategory(linkedIncident));
    };
    const formatSummaryTask = (task: any) => ({
      type: getSummaryTaskType(task),
      text: formatTaskText(task),
    });
    const formatTaskText = (task: any) => {
      const ticket = String(task.related_ticket ?? '').trim();
      return ticket ? `${ticket} - ${task.title}` : task.title;
    };
    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const escapeTableText = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    type SummaryTask = { type: string; text: string };
    const buildStatusTable = (label: string, icon: string, tasks: SummaryTask[]) => [
      `| Estado | Tipo | Incidencia |`,
      `|---|---|---|`,
      ...(tasks.length
        ? tasks.map((task) => `| ${icon} ${label} | ${escapeTableText(task.type)} | ${escapeTableText(task.text)} |`)
        : [`| ${icon} ${label} | — | Sin tareas |`]),
    ];
    const buildHtmlTable = (label: string, icon: string, color: string, tasks: SummaryTask[]) => {
      const rows = tasks.length ? tasks : [{ type: '—', text: 'Sin tareas' }];
      return `
        <table style="border-collapse: collapse; margin: 0 0 14px 0;">
          <thead>
            <tr>
              <th style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: left;">Estado</th>
              <th style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: left;">Tipo</th>
              <th style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: left;">Incidencia</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((task) => `
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 4px 8px; white-space: nowrap;">
                  <span style="color: ${color}; font-weight: 700;">${icon}</span> ${escapeHtml(label)}
                </td>
                <td style="border: 1px solid #d1d5db; padding: 4px 8px;">${escapeHtml(task.type)}</td>
                <td style="border: 1px solid #d1d5db; padding: 4px 8px;">${escapeHtml(task.text)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    };

    const summaryPeople = people
      .filter((person) => !person.name.toLowerCase().includes('marcos'))
      .map((person) => {
        const personTasks = activeDailyTasks
          .filter((task) => (task.person_id || task.assigned_to) === person.id)
          .filter((task) => !String(task.description || '').includes(NOTE_MARKER));

        return {
          person,
          inProgress: personTasks.filter((task) => task.status === 'in_progress').map(formatSummaryTask),
          pending: personTasks.filter((task) => task.status === 'pending').map(formatSummaryTask),
        };
      })
      .filter((item) => item.inProgress.length > 0 || item.pending.length > 0);

    const dayText = format(date, "d 'de' MMMM", { locale: es });
    const title = `Tareas del Día ${dayText.charAt(0).toUpperCase()}${dayText.slice(1)}`;
    const lines = [title];

    summaryPeople.forEach(({ person, inProgress, pending }) => {
      lines.push(
        '',
        '',
        `**${person.name.toUpperCase()}**`,
        '',
        'En curso',
        '',
        ...buildStatusTable('WIP', '🟠', inProgress),
        '',
        'Pendientes',
        '',
        ...buildStatusTable('Pendiente', '⚪', pending),
      );
    });

    const textSummary = lines.join('\n');
    const htmlSummary = `
      <div>
        <p><strong>${escapeHtml(title)}</strong></p>
        ${summaryPeople.map(({ person, inProgress, pending }) => `
          <br>
          <p style="margin: 14px 0 0 0;"><strong>${escapeHtml(person.name.toUpperCase())}</strong></p>
          <br>
          <p style="margin: 0;"><strong>En curso</strong></p>
          <br>
          ${buildHtmlTable('WIP', '●', '#f97316', inProgress)}
          <p style="margin: 0;"><strong>Pendientes</strong></p>
          <br>
          ${buildHtmlTable('Pendiente', '●', '#6b7280', pending)}
        `).join('')}
      </div>
    `;

    if (navigator.clipboard.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlSummary], { type: 'text/html' }),
          'text/plain': new Blob([textSummary], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(textSummary);
    }

    toast({
      title: 'Resumen copiado',
      description: `Se copió el resumen de ${summaryPeople.length} personas.`,
    });
  };

  const availableEpics = useMemo(() => {
    const set = new Set<string>();
    incidents.forEach((incident) => {
      const epic = String(incident.epic ?? '').trim();
      if (epic) set.add(epic);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [incidents]);

  const SortableHeader = ({ field, children }: { field: 'status' | 'title' | 'person'; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <div className="flex flex-col">
          <ChevronUp 
            className={`h-3 w-3 ${sortField === field && sortDirection === 'asc' ? 'text-primary' : 'text-muted-foreground'}`} 
          />
          <ChevronDown 
            className={`h-3 w-3 -mt-1 ${sortField === field && sortDirection === 'desc' ? 'text-primary' : 'text-muted-foreground'}`} 
          />
        </div>
      </div>
    </TableHead>
  );

  // Scroll preservation functionality
  const scrollPositionRef = useRef<number>(0);
  const shouldPreserveScrollRef = useRef<boolean>(false);

  // Save scroll position before any state update
  const preserveScroll = () => {
    scrollPositionRef.current = window.scrollY;
    shouldPreserveScrollRef.current = true;
  };

  const restorePreservedScroll = () => {
    if (!shouldPreserveScrollRef.current) return;

    const scrollY = scrollPositionRef.current;
    window.scrollTo(0, scrollY);
    window.requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
    shouldPreserveScrollRef.current = false;
  };
  
  // Drag and drop functionality
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !dailyId) return;

    const oldIndex = sortedTasks.findIndex((t) => t.id === active.id);
    const newIndex = sortedTasks.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;
    const activeTask = sortedTasks[oldIndex];
    const overTask = sortedTasks[newIndex];
    if (getDailyStatusGroup(activeTask) !== getDailyStatusGroup(overTask)) return;

    // Save scroll position before update
    preserveScroll();

    const newVisibleTasks = arrayMove(sortedTasks, oldIndex, newIndex).map((task, index) => ({
      ...task,
      order_position: index,
    }));
    const reorderedTasksById = new Map(newVisibleTasks.map((task) => [task.id, task]));
    const newTasks = tasks.map((task) => reorderedTasksById.get(task.id) ?? task);
    setTasks(newTasks);

    // Update order_position in database
    try {
      const updates = newVisibleTasks.map((task) => ({
        daily_id: dailyId,
        task_id: task.id,
        order_position: task.order_position ?? 0,
      }));

      const { error } = await supabase
        .from('daily_tasks')
        .upsert(updates, { onConflict: 'daily_id,task_id' });

      if (error) {
        toast({
          title: 'Error',
          description: 'No se pudo actualizar el orden',
          variant: 'destructive',
        });
        // Reload tasks to restore correct order
        preserveScroll();
        loadTasks(date);
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el orden',
        variant: 'destructive',
      });
      preserveScroll();
      loadTasks(date);
    }
  };

  // Restore scroll position after UI updates that can move focus or rerender the list.
  useLayoutEffect(() => {
    restorePreservedScroll();
  }, [tasks, detailsOpen, incidentDetailsOpen]);

  // Sortable task row component
  interface SortableTaskRowProps {
    task: any;
    person: any;
    incident: any;
  }

  const SortableTaskRow = ({ task, person, incident }: SortableTaskRowProps) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: task.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const isNote = String(task.description || '').includes(NOTE_MARKER);
    const displayedStatus = getDisplayedAssignmentStatus(task);
    const rowStatusValue = assignmentToSelectValue(displayedStatus.status, displayedStatus.status_environment);

    return (
      <TableRow ref={setNodeRef} style={style} className={cn(isDragging && 'relative z-50', isNote && 'bg-yellow-100 hover:bg-yellow-100/90')}>
        <TableCell className="w-8">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </TableCell>
        <TableCell>
          <Select
            value={rowStatusValue}
            onValueChange={(value) => updateTaskStatus(task, value as AssignmentStatusValue)}
          >
            <SelectTrigger className="h-8 w-[172px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNMENT_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <Badge variant="outline" className={`${getAppStatusTone(option.value)} text-[10px] px-1 py-0.5`}>
                    {option.label}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          {task.related_ticket ? (
            incident ? (
              <Button variant="link" className="px-0 flex items-center gap-1" onClick={() => openIncidentDetails(incident.id)}>
                {task.is_auto_linked && <Link className="h-3 w-3" />}
                {task.related_ticket}
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">{task.related_ticket}</span>
            )
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {renderCategoryIcon(getDisplayCategory(incident))}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              className={`h-6 w-6 ${task.is_urgent ? 'bg-red-500 hover:bg-red-600 text-white' : 'hover:bg-muted'}`}
              onClick={() => toggleUrgent(task.id, task.is_urgent || false)}
              aria-label={task.is_urgent ? "Desfijar tarea" : "Fijar tarea"}
              title={task.is_urgent ? "Desfijar tarea" : "Fijar tarea"}
            >
              <AlertTriangle className="h-3 w-3" />
            </Button>
            <div className="flex-1">
              <div className="font-medium">{task.title}</div>
              {typeof task.description === 'string' && !String(task.description).includes(NOTE_MARKER) && (
                <div className="text-xs text-muted-foreground">
                  {task.description.length > 70 ? `${task.description.slice(0, 70)}...` : task.description}
                </div>
              )}
              {person && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: person.color }} />
                  {person.name}
                </div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">{incident?.epic || '—'}</span>
        </TableCell>
        <TableCell className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => deleteTask(task)} aria-label="Eliminar">
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };
  const loadTaskComments = async (taskId: string) => {
    const {
      data
    } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at', {
      ascending: true
    });
    setTaskComments(data || []);
  };

  // Helpers para formatear etiqueta de incidencia
  const getTicketCode = (incident: any) => {
    return formatIncidentReference(incident);
  };
  const formatIncidentLabel = (incident: any) => {
    const code = getTicketCode(incident);
    return code ? `${code} - ${incident.name}` : incident.name;
  };

  const formatTaskManualId = (value: string | number | null | undefined) => {
    return String(value ?? '').replace(/\D/g, '').slice(0, 6);
  };

  const formatDailyTaskRelatedTicket = (task: any, linkedIncident?: any) => {
    const incidentReference = formatIncidentReference(linkedIncident);
    if (incidentReference) return incidentReference;
    const value = String(task?.related_ticket ?? '').trim();
    return /^INT\d+$/i.test(value) ? formatInternalTaskIdFromValue(value) : formatTaskManualId(value);
  };

  const loadNextAutoTaskId = async () => {
    return (await loadNextInternalTaskId(projectId)).label;
  };

  const getCategoryLabel = (category: string | null | undefined) => {
    if (category === 'incident') return 'Incidencia';
    if (category === 'improvement') return 'Evolutivo';
    if (category === 'corrective_improvement') return 'Mejora correctiva';
    return 'Sin tipo';
  };

  const getDisplayCategory = (incident: any) => {
    if (!incident) return null;
    if (incident.category === 'corrective_improvement' || String(incident.additional_comments ?? '').includes('[tipo:mejora_correctiva]')) {
      return 'corrective_improvement';
    }
    return incident.category;
  };

  const renderCategoryIcon = (category: string | null | undefined) => {
    if (category === 'incident') {
      return <span title="Incidencia" className="inline-grid place-items-center h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">I</span>;
    }
    if (category === 'improvement') {
      return <span title="Evolutivo" className="inline-grid place-items-center h-5 w-5 rounded-sm bg-primary text-primary-foreground text-[10px] font-bold">E</span>;
    }
    if (category === 'corrective_improvement') {
      return <span title="Mejora correctiva" className="inline-grid place-items-center h-5 w-5 rounded-sm bg-purple-600 text-white text-[10px] font-bold">C</span>;
    }
    return <span className="text-muted-foreground">—</span>;
  };

  const isMutedCalendarDay = (day: Date) => {
    return isBefore(startOfDay(day), startOfDay(new Date())) || isWeekend(day);
  };

  const DayContent = (props: any) => {
    const { date: dayDate } = props;
    const day = format(dayDate, 'd');
    const isGrayedOut = isMutedCalendarDay(dayDate);

    return (
      <div className={cn("flex flex-col items-center justify-center", isGrayedOut && "opacity-40")}>
        <span>{day}</span>
      </div>
    );
  };

  const selectedDateVacations = useMemo(() => {
    const selectedDay = startOfDay(date);
    return vacations.filter(vacation => {
      const startDate = startOfDay(parseISO(vacation.start_date));
      const endDate = startOfDay(parseISO(vacation.end_date));
      return isWithinInterval(selectedDay, { start: startDate, end: endDate });
    });
  }, [date, vacations]);

  const selectedDateVacationPeople = useMemo(() => {
    const names = selectedDateVacations
      .map(vacation => people.find(person => person.id === vacation.person_id)?.name)
      .filter(Boolean) as string[];

    return Array.from(new Set(names));
  }, [people, selectedDateVacations]);

  const taskCountSummary = useMemo(() => {
    const counts = new Map<string, {
      id: string;
      name: string;
      color?: string;
      pending: number;
      inProgress: number;
      resolved: number;
      blocked: number;
    }>();

    activeDailyTasks.forEach(task => {
      const person = people.find(p => p.id === (task.person_id || task.assigned_to));
      const key = person?.id || 'unassigned';
      const current = counts.get(key) || {
        id: key,
        name: person?.name || 'Sin asignar',
        color: person?.color,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        blocked: 0,
      };
      const next = { ...current };
      if (task.status === 'in_progress') next.inProgress += 1;
      else if (isResolvedTask(task.status)) next.resolved += 1;
      else if (task.status === 'blocked') next.blocked += 1;
      else next.pending += 1;
      counts.set(key, {
        color: person?.color || current.color,
        ...next,
      });
    });

    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [people, activeDailyTasks]);

  const taskCreationIncidents = useMemo(() => {
    const query = incidentSearchQuery.trim().toLowerCase();

    return incidents
      .filter(i => i.status !== 'resolved')
      .filter(i => incidentCategoryFilter === 'all' || getDisplayCategory(i) === incidentCategoryFilter)
      .filter(i => {
        if (!query) return true;
        const ticketCode = getTicketCode(i)?.toLowerCase() || '';
        const name = i.name?.toLowerCase() || '';
        return ticketCode.includes(query) || name.includes(query);
      });
  }, [incidents, incidentSearchQuery, incidentCategoryFilter]);

  const openIncidentDetails = (incidentId: string) => {
    preserveScroll();
    setSelectedIncidentId(incidentId);
    setIncidentDetailsOpen(true);
  };


  const openDetails = async (task: any) => {
    preserveScroll();
    setSelectedTask(task);
    const linkedIncident = incidents.find(i => i.id === task.incident_id);
    let personIds = task.person_id ? [task.person_id] : [];
    if (task.incident_id) {
      const { data: assignmentRows } = await supabase
        .from('incident_assignments')
        .select('assigned_to')
        .eq('incident_id', task.incident_id);
      const assignmentIds = (assignmentRows || []).map((row: any) => row.assigned_to).filter(Boolean);
      if (assignmentIds.length > 0) personIds = assignmentIds;
    }
    setEditForm({
      title: task.title || '',
      relatedTicket: formatDailyTaskRelatedTicket(task, linkedIncident),
      description: task.description || '',
      personIds,
      incidentId: task.incident_id || '',
      epic: linkedIncident?.epic || '',
      status: task.status as TaskStatus || 'pending',
      environment: task.status_environment || '',
      category: getDisplayCategory(linkedIncident) || 'incident'
    });
    setEditing(false);
    setDetailsOpen(true);
    await loadTaskComments(task.id);
  };
  const addTaskComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !user || !commentText.trim()) return;
    const {
      error
    } = await supabase.from('task_comments').insert({
      task_id: selectedTask.id,
      user_id: user.id,
      user_email: user.email,
      content: commentText.trim()
    });
    if (!error) {
      setCommentText('');
      loadTaskComments(selectedTask.id);
    } else {
      toast({
        title: 'Error',
        description: 'No se pudo añadir el comentario',
        variant: 'destructive'
      });
    }
  };
  // Autosave task edits (500ms debounce) with incident sync
  useEffect(() => {
    if (!selectedTask) return;
    const handler = setTimeout(async () => {
      preserveScroll();
      const linkedIncident = incidents.find(i => i.id === editForm.incidentId);
      const relatedTicket = editForm.relatedTicket.trim()
        ? formatDailyTaskRelatedTicket({ related_ticket: editForm.relatedTicket }, linkedIncident)
        : '';
      const taskEnvironment = normalizeTaskEnvironment(editForm.status, editForm.environment);
      if (isResolvedTask(editForm.status) && !taskEnvironment) {
        return;
      }
      const update = {
        title: editForm.title,
        related_ticket: relatedTicket || null,
        description: editForm.description || null,
        person_id: editForm.personIds.length > 0 ? editForm.personIds[0] : null,
        incident_id: editForm.incidentId || null,
        status: editForm.status,
        status_environment: taskEnvironment || null,
        is_auto_linked: Boolean(editForm.incidentId || selectedTask.is_auto_linked),
      };
      const {
        error
      } = await supabase.from('tasks').update(update).eq('id', selectedTask.id);
      if (!error) {
        // If task is linked to Home, keep the incident in sync with daily edits.
        if (update.incident_id && relatedTicket) {
          const { data: currentIncident } = await supabase
            .from('incidents')
            .select('status, incident_number, name, category, additional_comments, status_environment')
            .eq('id', update.incident_id)
            .maybeSingle();

          const nextIncidentStatus = mapTaskStatusToIncidentStatus(update.status);
          const nextCategory = serializeCategory(editForm.category, currentIncident?.additional_comments);
          const nextIncidentNumber = extractInternalTaskNumber(relatedTicket);
          if (!nextIncidentNumber) return;
          await supabase
            .from('incidents')
            .update({
              incident_number: nextIncidentNumber,
              name: update.title,
              epic: editForm.epic || null,
              description: update.description,
              status: nextIncidentStatus,
              assigned_to: update.person_id,
              status_environment: taskEnvironment || null,
              category: nextCategory.category,
              additional_comments: nextCategory.additional_comments,
            } as any)
            .eq('id', update.incident_id);

          if (
            currentIncident &&
            (currentIncident.status !== nextIncidentStatus || normalizeTaskEnvironment(mapIncidentStatusToTaskStatus(currentIncident.status) as TaskStatus, currentIncident.status_environment || '') !== taskEnvironment)
          ) {
            await recordIncidentStatusChange({
              projectId,
              incidentId: update.incident_id,
              incidentNumber: nextIncidentNumber,
              incidentName: update.title,
              incidentCategory: currentIncident.category,
              fromStatus: currentIncident.status,
              toStatus: nextIncidentStatus,
              fromEnvironment: currentIncident.status_environment,
              toEnvironment: taskEnvironment || null,
            });
          }

          const desiredPersonIds = Array.from(new Set(editForm.personIds.filter(Boolean)));
          const { data: existingAssignments } = await supabase
            .from('incident_assignments')
            .select('id, assigned_to')
            .eq('incident_id', update.incident_id);

          const existingByPerson = new Map<string, any>();
          (existingAssignments || []).forEach((assignment: any) => {
            existingByPerson.set(assignment.assigned_to, assignment);
          });

          const desiredSet = new Set(desiredPersonIds);
          const toDeleteIds = (existingAssignments || [])
            .filter((assignment: any) => !desiredSet.has(assignment.assigned_to))
            .map((assignment: any) => assignment.id);

          if (toDeleteIds.length > 0) {
            await supabase.from('incident_assignments').delete().in('id', toDeleteIds);
          }

          for (const personId of desiredPersonIds) {
            const existing = existingByPerson.get(personId);
            if (existing) {
              await supabase
                .from('incident_assignments')
                .update({
                  status: mapTaskStatusToIncidentStatus(update.status),
                  status_environment: taskEnvironment || null,
                } as any)
                .eq('id', existing.id);
            } else {
              await supabase.from('incident_assignments').insert({
                incident_id: update.incident_id,
                assigned_to: personId,
                status: mapTaskStatusToIncidentStatus(update.status),
                status_environment: taskEnvironment || null,
              } as any);
            }
          }

          const { data: linkedTasks } = await supabase
            .from('tasks')
            .select('id, person_id, assigned_to')
            .eq('incident_id', update.incident_id)
            .eq('is_auto_linked', true);

          const existingTasksByPerson = new Map<string, any>();
          (linkedTasks || []).forEach((taskRow: any) => {
            const personId = taskRow.person_id || taskRow.assigned_to;
            if (personId) existingTasksByPerson.set(personId, taskRow);
          });

          const personsToDelete = (linkedTasks || [])
            .filter((taskRow: any) => {
              const personId = taskRow.person_id || taskRow.assigned_to;
              return personId && !desiredSet.has(personId);
            })
            .map((taskRow: any) => taskRow.id);

          if (personsToDelete.length > 0) {
            await supabase.from('daily_tasks').delete().in('task_id', personsToDelete);
            await supabase.from('tasks').delete().in('id', personsToDelete);
          }

          for (const personId of desiredPersonIds) {
            const existingTask = existingTasksByPerson.get(personId);
            if (existingTask) {
              await supabase
                .from('tasks')
                .update({
                  title: update.title,
                  description: update.description || null,
                  related_ticket: relatedTicket || null,
                  status: update.status,
                  status_environment: taskEnvironment || null,
                  person_id: personId,
                  assigned_to: personId,
                } as any)
                .eq('id', existingTask.id);
            } else {
              const { data: createdTask } = await supabase
                .from('tasks')
                .insert({
                  title: update.title,
                  description: update.description || null,
                  project_id: projectId,
                  daily_id: selectedTask.daily_id,
                  incident_id: update.incident_id,
                  person_id: personId,
                  assigned_to: personId,
                  status: update.status,
                  status_environment: taskEnvironment || null,
                  is_auto_linked: true,
                  related_ticket: relatedTicket || null,
                } as any)
                .select('id')
                .single();

              if (createdTask?.id && selectedTask.daily_id) {
                await supabase.from('daily_tasks').upsert({
                  daily_id: selectedTask.daily_id,
                  task_id: createdTask.id,
                } as any, { onConflict: 'daily_id,task_id' } as any);
              }
            }
          }
          
          loadBaseData(); // Reload incidents to reflect status change
          loadTasks(date);
        }
        
        setTasks(t => t.map(x => x.id === selectedTask.id ? {
          ...x,
          ...update
        } : x));
        setSelectedTask(prev => prev ? {
          ...prev,
          ...update
        } : prev);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [editForm, selectedTask]);
  if (!unlocked) {
    return <Card>
        <CardHeader>
          <CardTitle>Acceso a Seguimiento diario</CardTitle>
          <CardDescription>Introduce la contraseña de seguimiento diario</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onUnlock} className="flex gap-2 max-w-md">
            <Input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Contraseña de seguimiento diario" required />
            <Button type="submit">Acceder</Button>
          </form>
        </CardContent>
      </Card>;
  }
  return (
    <div className="grid gap-6 md:grid-cols-1">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-end gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openPersistModal}>Persistir</Button>
              <Button variant="outline" onClick={() => { loadAllTasks(); setViewAllTasksOpen(true); }}>Ver todas</Button>
              <Button
                variant="outline"
                onClick={() => window.open('https://cepsacorp.sharepoint.com/:x:/s/EnergyParks-Aplicacionesmviles/IQCYSpOGmtWnTapOf5J-ytbyAROm3UjaCgYH8ORv13rZXro?e=fA8BrC', '_blank', 'noopener,noreferrer')}
              >
                Ver Excel Incidencias
              </Button>
              <Button onClick={() => setCreateTaskOpen(true)} aria-label="Crear tarea" title="Crear tarea">+</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Calendar */}
            <div className="flex justify-center">
              <div className="w-fit">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  locale={es}
                  className="rounded-md border p-3 pointer-events-auto mx-auto"
                  modifiers={{ mutedDay: isMutedCalendarDay }}
                  modifiersClassNames={{
                    mutedDay: "bg-muted/50 text-muted-foreground hover:bg-muted/60"
                  }}
                  components={{ DayContent: DayContent as any }}
                />
                {selectedDateVacationPeople.length > 0 && (
                  <div className="mt-3 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-900">
                    Ausencias: {selectedDateVacationPeople.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Tasks List */}
            <div className="w-full">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNoteForm({ comment: '', personId: '', date: dateToLocalInputValue(date) });
                      setNoteOpen(true);
                    }}
                  >
                    Añadir nota
                  </Button>
                  <Button variant="outline" onClick={copyDailySummary}>
                    Resumen diario
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    loadBaseData();
                    loadTasks(date);
                  }}
                  aria-label="Actualizar"
                  title="Actualizar"
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
              {dailyPersistenceSummary && (
                <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                  {dailyPersistenceSummary.tasksPersisted} tareas persistidas a las {dailyPersistenceSummary.persistedAt} horas.
                </div>
              )}
              {taskCountSummary.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2 text-sm">
                  {taskCountSummary.map(item => (
                    <Badge
                      key={item.id}
                      variant="outline"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPersonFilter(current => current === item.id ? 'all' : item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedPersonFilter(current => current === item.id ? 'all' : item.id);
                      }}
                      className={cn(
                        "cursor-pointer border border-border bg-background",
                        selectedPersonFilter === item.id && "bg-primary/20 border-primary"
                      )}
                    >
                      <span className="mr-2">{item.name}</span>
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--warning))] text-[10px] font-semibold text-[hsl(var(--warning-foreground))]"
                          title={`WIP: ${item.inProgress}`}
                        >
                          {item.inProgress}
                        </span>
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
                          title={`Pendientes: ${item.pending}`}
                        >
                          {item.pending}
                        </span>
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--success))] text-[10px] font-semibold text-[hsl(var(--success-foreground))]"
                          title={`Resueltas: ${item.resolved}`}
                        >
                          {item.resolved}
                        </span>
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground"
                          title={`Block: ${item.blocked}`}
                        >
                          {item.blocked}
                        </span>
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table className="mt-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tarea</TableHead>
                      <TableHead>Épica</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasksLoading ? (
                      Array.from({ length: 8 }).map((_, index) => (
                        <TableRow key={`tasks-loading-${index}`}>
                          <TableCell className="w-8">
                            <Skeleton className="h-4 w-4" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-8 w-[172px]" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-5 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-full max-w-[420px]" />
                              <Skeleton className="h-3 w-full max-w-[260px]" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-8 w-8" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <>
                        <SortableContext
                          items={sortedTasks.map(t => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {sortedTasks.map((t) => {
                            const person = people.find((p) => p.id === (t.person_id || t.assigned_to));
                            const inc = incidents.find((i) => i.id === t.incident_id);
                            return (
                              <SortableTaskRow
                                key={t.id}
                                task={t}
                                person={person}
                                incident={inc}
                              />
                            );
                          })}
                        </SortableContext>
                        {sortedTasks.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              Sin tareas para este día
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Crear Tarea */}

      <Dialog open={createTaskOpen} onOpenChange={(open) => {
        setCreateTaskOpen(open);
        if (!open) {
          setCreationMode('select');
          setIncidentSearchQuery('');
          setIncidentCategoryFilter('all');
          setManualTaskIdEnabled(true);
          setTaskForm({
            title: '',
            description: '',
            personIds: [],
            incidentId: '',
            epic: '',
            status: 'pending',
            environment: '',
            relatedTicket: '',
            category: 'incident'
          });
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Crear tarea</DialogTitle>
            <DialogDescription>
              {creationMode === 'select' && 'Selecciona una incidencia existente o crea una incidencia manual'}
              {creationMode === 'linked' && 'Tarea vinculada a incidencia (información precargada)'}
              {creationMode === 'manual' && 'Crear tarea manual'}
            </DialogDescription>
          </DialogHeader>

          {creationMode === 'select' && (
            <div className="space-y-4">
              <div>
                <Label>Vincular con incidencia existente</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_180px]">
                  <Input 
                    placeholder="Buscar por número o nombre..."
                    value={incidentSearchQuery}
                    onChange={(e) => setIncidentSearchQuery(e.target.value)}
                  />
                  <Select value={incidentCategoryFilter} onValueChange={value => setIncidentCategoryFilter(value as 'all' | IncidentCategory)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="incident">Incidencias</SelectItem>
                      <SelectItem value="improvement">Evolutivos</SelectItem>
                      <SelectItem value="corrective_improvement">Mejoras correctoras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ScrollArea className="h-[300px] border rounded-md p-3 mt-2">
                  <div className="space-y-2">
                    {taskCreationIncidents.map(incident => (
                      <Card
                        key={incident.id}
                        className="cursor-pointer hover:bg-accent transition-colors p-3"
                        onClick={() => handleIncidentSelect(incident.id)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {getTicketCode(incident)}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {incident.name}
                              </div>
                            </div>
                            <Badge 
                              variant="outline"
                              className={`text-xs whitespace-nowrap ${
                                incident.status === 'in_progress' 
                                  ? 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent'
                                  : 'bg-muted text-muted-foreground border-transparent'
                              }`}
                            >
                              {incident.status === 'in_progress' ? 'WIP' : 'Pendiente'}
                            </Badge>
                          </div>
                          {incident.category && (
                            <div className="text-xs text-muted-foreground">
                              {getCategoryLabel(getDisplayCategory(incident))}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                    {taskCreationIncidents.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        {incidentSearchQuery.trim() || incidentCategoryFilter !== 'all' ? 'No se encontraron tareas' : 'No hay tareas activas'}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 border-t" />
                <span className="text-sm text-muted-foreground">o</span>
                <div className="flex-1 border-t" />
              </div>

              <Button 
                variant="secondary" 
                className="w-full"
                onClick={openHomeCreateTaskModal}
              >
                Crear incidencia manual
              </Button>
            </div>
          )}

          {(creationMode === 'linked' || creationMode === 'manual') && (
            <form onSubmit={addTask} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {creationMode === 'linked' && (
                <div className="md:col-span-2 p-3 bg-muted rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className="bg-primary">Vinculada</Badge>
                    <span className="font-medium">
                      {formatIncidentLabel(incidents.find(i => i.id === taskForm.incidentId)!)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Los cambios de estado se sincronizarán automáticamente
                  </p>
                </div>
              )}

              {creationMode === 'manual' && (
                <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">Manual</Badge>
                    <span className="text-muted-foreground">Tarea creada manualmente</span>
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <RequiredLabel>Título</RequiredLabel>
                <Input value={taskForm.title} onChange={e => setTaskForm(f => ({
                  ...f,
                  title: e.target.value
                }))} required />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <RequiredLabel>ID</RequiredLabel>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="manual-task-id" className="text-xs text-muted-foreground">Manual</Label>
                    <Switch
                      id="manual-task-id"
                      checked={manualTaskIdEnabled}
                      onCheckedChange={async (checked) => {
                        setManualTaskIdEnabled(checked);
                        if (!checked) {
                          const autoId = await loadNextAutoTaskId();
                          setTaskForm(f => ({ ...f, relatedTicket: autoId }));
                        } else {
                          setTaskForm(f => ({ ...f, relatedTicket: formatTaskManualId(f.relatedTicket) }));
                        }
                      }}
                    />
                  </div>
                </div>
                <Input
                  inputMode={manualTaskIdEnabled ? 'numeric' : 'text'}
                  pattern={manualTaskIdEnabled ? '[0-9]*' : undefined}
                  maxLength={manualTaskIdEnabled ? 6 : undefined}
                  placeholder={manualTaskIdEnabled ? 'Máx. 6 dígitos' : 'INT1'}
                  value={taskForm.relatedTicket}
                  onChange={e => setTaskForm(f => ({
                    ...f,
                    relatedTicket: manualTaskIdEnabled ? formatTaskManualId(e.target.value) : e.target.value
                  }))}
                  readOnly={!manualTaskIdEnabled}
                  required={manualTaskIdEnabled}
                />
              </div>
              {creationMode === 'manual' && (
                <div>
                  <RequiredLabel>Tipo</RequiredLabel>
                  <Select value={taskForm.category} onValueChange={v => setTaskForm(f => ({
                    ...f,
                    category: v as IncidentCategory
                  }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incident">Incidencia</SelectItem>
                      <SelectItem value="improvement">Evolutivo</SelectItem>
                      <SelectItem value="corrective_improvement">Mejora correctora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(creationMode === 'linked' || creationMode === 'manual') && (
                <div>
                  <Label>Épica</Label>
                  <Select value={taskForm.epic || '__none__'} onValueChange={value => setTaskForm(f => ({ ...f, epic: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Sin épica" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin épica</SelectItem>
                      {availableEpics.map(epic => (
                        <SelectItem key={epic} value={epic}>{epic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Personas</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {taskForm.personIds.length === 0 
                        ? "Sin asignar" 
                        : `${taskForm.personIds.length} persona${taskForm.personIds.length > 1 ? 's' : ''} seleccionada${taskForm.personIds.length > 1 ? 's' : ''}`
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandList>
                        <CommandEmpty>No se encontraron personas.</CommandEmpty>
                        <CommandGroup>
                          {people.map((person) => (
                            <CommandItem
                              key={person.id}
                              value={person.id}
                              onSelect={() => {
                                setTaskForm(f => ({
                                  ...f,
                                  personIds: f.personIds.includes(person.id)
                                    ? f.personIds.filter(id => id !== person.id)
                                    : [...f.personIds, person.id]
                                }));
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: person.color }}
                                />
                                <span>{person.name}</span>
                              </div>
                              <Checkbox 
                                checked={taskForm.personIds.includes(person.id)}
                                className="ml-auto"
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={assignmentToSelectValue(taskForm.status, taskForm.environment)}
                  onValueChange={v => setTaskForm(f => {
                    const next = selectValueToAssignment(v as AssignmentStatusValue);
                    const nextStatus = mapIncidentStatusToTaskStatus(next.status) as TaskStatus;
                    return {
                      ...f,
                      status: nextStatus,
                      environment: next.environment || '',
                    };
                  })}
                >
                  <SelectTrigger><SelectValue placeholder="Pendiente" /></SelectTrigger>
                  <SelectContent>
                    {DAILY_TASK_FORM_STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <Badge variant="outline" className={`${getAppStatusTone(option.value)} text-[10px] px-1 py-0.5`}>
                          {option.label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({
                  ...f,
                  description: e.target.value
                }))} />
              </div>
              
              <div className="md:col-span-2 flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setCreationMode('select');
                    setIncidentCategoryFilter('all');
                    setManualTaskIdEnabled(true);
                    setTaskForm({
                      title: '',
                      description: '',
                      personIds: [],
                      incidentId: '',
                      epic: '',
                      status: 'pending',
                      environment: '',
                      relatedTicket: '',
                      category: 'incident'
                    });
                  }}
                >
                  Volver
                </Button>
                <Button type="submit" disabled={!dailyId} className="flex-1">Crear</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir nota</DialogTitle>
            <DialogDescription>La nota aparecerá en Seguimiento diario el día indicado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addNote} className="space-y-4">
            <div className="space-y-2">
              <RequiredLabel>Comentario</RequiredLabel>
              <Textarea
                value={noteForm.comment}
                onChange={(e) => setNoteForm(f => ({ ...f, comment: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Persona</RequiredLabel>
              <Select value={noteForm.personId} onValueChange={(value) => setNoteForm(f => ({ ...f, personId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar persona" />
                </SelectTrigger>
                <SelectContent>
                  {people.map(person => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <RequiredLabel>Día</RequiredLabel>
              <Input
                type="date"
                value={noteForm.date}
                onChange={(e) => setNoteForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar nota</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle de Tarea */}
      <Dialog open={detailsOpen} onOpenChange={o => {
        preserveScroll();
        setDetailsOpen(o);
        if (!o) {
          loadBaseData();
          loadTasks(date);
          setSelectedTask(null);
          setEditing(false);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de tarea
              {selectedTask && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if (!selectedTask) return;
                      
                      const taskIdInfo = selectedTask.related_ticket
                        ? `ID: ${selectedTask.related_ticket}`
                        : 'ID: Sin completar';
                      
                      const info = `Título: ${selectedTask.title || 'Sin título'}
Estado: ${getTaskCompositeStatusLabel(selectedTask.status as TaskStatus, selectedTask.status_environment)}
${taskIdInfo}
Descripción: ${selectedTask.description || 'Sin descripción'}`;
                      
                      navigator.clipboard.writeText(info).then(() => {
                        toast({ title: 'Información copiada', description: 'La información ha sido copiada al portapapeles' });
                      }).catch(() => {
                        toast({ title: 'Error', description: 'No se pudo copiar la información', variant: 'destructive' });
                      });
                    }} 
                    className="p-1" 
                    title="Copiar info"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if (!selectedTask) return;
                      if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
                        deleteTask(selectedTask);
                        setDetailsOpen(false);
                      }
                    }} 
                    className="text-destructive hover:text-destructive p-1"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </DialogTitle>
            <DialogDescription>Ver información completa y comentarios</DialogDescription>
          </DialogHeader>

          {selectedTask && <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <RequiredLabel>Título</RequiredLabel>
                  <Input value={editForm.title} onChange={e => setEditForm(f => ({
                ...f,
                title: e.target.value
              }))} required />
                </div>
                <div>
                  <RequiredLabel>ID</RequiredLabel>
                  <Input
                    inputMode={/^INT/i.test(editForm.relatedTicket) ? 'text' : 'numeric'}
                    pattern={/^INT/i.test(editForm.relatedTicket) ? undefined : '[0-9]*'}
                    maxLength={/^INT/i.test(editForm.relatedTicket) ? undefined : 6}
                    placeholder={/^INT/i.test(editForm.relatedTicket) ? 'INT1' : 'Máx. 6 dígitos'}
                    value={editForm.relatedTicket}
                    onChange={e => setEditForm(f => ({
                      ...f,
                      relatedTicket: /^INT/i.test(f.relatedTicket) || /^INT/i.test(e.target.value)
                        ? formatInternalTaskIdFromValue(e.target.value)
                        : formatTaskManualId(e.target.value)
                    }))}
                    required
                  />
                </div>
                <div>
                  <Label>Personas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {editForm.personIds.length === 0 
                          ? "Sin asignar" 
                          : `${editForm.personIds.length} persona${editForm.personIds.length > 1 ? 's' : ''} seleccionada${editForm.personIds.length > 1 ? 's' : ''}`
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                      <Command>
                        <CommandList>
                          <CommandEmpty>No se encontraron personas.</CommandEmpty>
                          <CommandGroup>
                            {people.map((person) => (
                              <CommandItem
                                key={person.id}
                                value={person.id}
                                onSelect={() => {
                                  setEditForm(f => ({
                                    ...f,
                                    personIds: f.personIds.includes(person.id)
                                      ? f.personIds.filter(id => id !== person.id)
                                      : [...f.personIds, person.id]
                                  }));
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: person.color }}
                                  />
                                  <span>{person.name}</span>
                                </div>
                                <Checkbox 
                                  checked={editForm.personIds.includes(person.id)}
                                  className="ml-auto"
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                 <div>
                   <Label>Estado</Label>
                   <Select
                     value={assignmentToSelectValue(editForm.status, editForm.environment)}
                     onValueChange={(value) => updateSelectedTaskStatus(value as AssignmentStatusValue)}
                   >
                     <SelectTrigger><SelectValue placeholder="Pendiente" /></SelectTrigger>
                     <SelectContent>
                       {DAILY_TASK_FORM_STATUS_OPTIONS.map(option => (
                         <SelectItem key={option.value} value={option.value}>
                           <Badge variant="outline" className={`${getAppStatusTone(option.value)} text-[10px] px-1 py-0.5`}>
                             {option.label}
                           </Badge>
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="md:col-span-2">
                   <Label>Descripción</Label>
                   <Textarea value={editForm.description} onChange={e => setEditForm(f => ({
                 ...f,
                 description: e.target.value
               }))} />
                 </div>
                <div className="md:col-span-2">
                  <Label>Vincular a incidencia</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        <span className="block max-w-full truncate text-left">
                          {editForm.incidentId
                            ? formatIncidentLabel(incidents.find(i => i.id === editForm.incidentId) || { name: 'Ninguna', incident_number: null })
                            : 'Ninguna'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] max-h-[360px] p-0 overflow-hidden">
                      <Command>
                        <CommandInput placeholder="Buscar incidencia..." />
                        <CommandList className="max-h-[280px]">
                          <CommandEmpty>No se encontraron incidencias.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setEditForm(f => ({ ...f, incidentId: '', epic: '' }));
                              }}
                            >
                              Ninguna
                            </CommandItem>
                             {incidents.map(i => (
                               <CommandItem
                                 key={i.id}
                                 value={formatIncidentLabel(i)}
                 onSelect={() => {
                                   setEditForm(f => ({
                                     ...f,
                                     incidentId: i.id,
                                     relatedTicket: formatIncidentReference(i) || '',
                                     epic: i.epic || '',
                                     category: getDisplayCategory(i) || f.category,
                                   }));
                                 }}
                               >
                                 <span className="block max-w-full truncate" title={formatIncidentLabel(i)}>
                                   {formatIncidentLabel(i)}
                                 </span>
                               </CommandItem>
                             ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={value => setEditForm(f => ({ ...f, category: value as IncidentCategory }))}
                    disabled={!editForm.incidentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incident">Incidencia</SelectItem>
                      <SelectItem value="improvement">Evolutivo</SelectItem>
                      <SelectItem value="corrective_improvement">Mejora correctora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Épica</Label>
                  <Select value={editForm.epic || '__none__'} onValueChange={value => setEditForm(f => ({ ...f, epic: value === '__none__' ? '' : value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin épica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin épica</SelectItem>
                      {availableEpics.map(epic => (
                        <SelectItem key={epic} value={epic}>{epic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="font-medium mb-2">Comentarios</h4>
                <div className="space-y-2 max-h-60 overflow-auto pr-1">
                  {taskComments.map(c => <div key={c.id} className="rounded border p-2">
                      <div className="text-xs text-muted-foreground mb-1">{c.user_email || 'Anónimo'} • {new Date(c.created_at).toLocaleString()}</div>
                      <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                    </div>)}
                  {taskComments.length === 0 && <div className="text-sm text-muted-foreground">Sin comentarios aún</div>}
                </div>
                <form onSubmit={addTaskComment} className="mt-3 space-y-2">
                  <Label>Nuevo comentario</Label>
                  <Textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Escribe un comentario" />
                  <div className="text-right">
                    <Button type="submit" disabled={!user}>Comentar</Button>
                  </div>
                </form>
              </div>
            </div>}
        </DialogContent>
      </Dialog>

      {/* Modal de persistir tareas */}
      <Dialog open={persistModalOpen} onOpenChange={setPersistModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Persistir tareas</DialogTitle>
            <DialogDescription>Selecciona las tareas del último día que quieres persistir</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {lastDayTasks.map(task => {
                const person = people.find(p => p.id === (task.person_id || task.assigned_to));
                const isSelected = selectedTasksForPersist.includes(task.id);
                const isPersistable = !isResolvedTask(task.status as TaskStatus);
                return <div key={task.id} className="flex items-start gap-3 p-3 border rounded">
                      <Checkbox checked={isSelected} disabled={!isPersistable} onCheckedChange={checked => {
                    if (checked) {
                      setSelectedTasksForPersist(prev => [...prev, task.id]);
                    } else {
                      setSelectedTasksForPersist(prev => prev.filter(id => id !== task.id));
                    }
                  }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{task.title}</div>
                        {task.description && !String(task.description).includes(NOTE_MARKER) && <div className="text-sm text-muted-foreground mt-1">{task.description}</div>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <Badge 
                            variant="outline"
                            className={getTaskStatusTone(task.status as TaskStatus)}
                          >
	            {getTaskCompositeStatusLabel(task.status as TaskStatus, task.status_environment)}
                          </Badge>
                          {person && <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded" style={{
                          backgroundColor: person.color
                        }} />
                              {person.name}
                            </div>}
                        </div>
                      </div>
                    </div>;
              })}
                {lastDayTasks.length === 0 && <div className="text-center text-muted-foreground py-8">
                    No hay tareas en el último día con tareas
                  </div>}
              </div>
            </ScrollArea>
            
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setSelectedTasksForPersist(lastDayTasks.filter(t => !isResolvedTask(t.status as TaskStatus)).map(t => t.id))} disabled={lastDayTasks.length === 0}>
                Seleccionar todas
              </Button>
              <Button variant="outline" onClick={() => setSelectedTasksForPersist(prev => prev.filter(taskId => {
                const task = lastDayTasks.find(t => t.id === taskId);
                return task ? !isResolvedTask(task.status as TaskStatus) : true;
              }))}>
                Deseleccionar resueltas
              </Button>
              <Button variant="outline" onClick={() => setSelectedTasksForPersist([])}>
                Deseleccionar todas
              </Button>
              <Button onClick={persistSelectedTasks} disabled={selectedTasksForPersist.length === 0} className="ml-auto">
                Persistir {selectedTasksForPersist.length} tareas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ver todas las tareas */}
      <Dialog open={viewAllTasksOpen} onOpenChange={setViewAllTasksOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Todas las tareas</DialogTitle>
            <DialogDescription>Vista completa de todas las tareas del proyecto</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input placeholder="Buscar tareas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="in_progress">WIP</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="resolved">Resuelta</SelectItem>
                  <SelectItem value="blocked">Block</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="status">Estado</SortableHeader>
                    <SortableHeader field="title">Tarea</SortableHeader>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <SortableHeader field="person">Persona</SortableHeader>
                    <TableHead>Creada</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map(task => {
                  const person = people.find(p => p.id === (task.person_id || task.assigned_to));
                  const incident = incidents.find(i => i.id === task.incident_id);
                  return <TableRow key={task.id}>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={getTaskStatusTone(task.status as TaskStatus)}
                          >
                            {getTaskCompositeStatusLabel(task.status as TaskStatus, task.status_environment)}
                          </Badge>
                        </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             {task.assigned_to && (
                               <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                             )}
                             <div className="font-medium">{task.title}</div>
                           </div>
                           {typeof task.description === 'string' && !String(task.description).includes(NOTE_MARKER) && <div className="text-xs text-muted-foreground">{task.description.length > 150 ? `${task.description.slice(0, 150)}...` : task.description}</div>}
                         </TableCell>
                        <TableCell>
                          {task.related_ticket ? (
                            <span className="text-sm text-muted-foreground">{task.related_ticket}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{renderCategoryIcon(getDisplayCategory(incident))}</TableCell>
                        <TableCell>
                          {person ? <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded" style={{
                          backgroundColor: person.color
                        }} />
                              {person.name}
                            </div> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {new Date(task.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {/* Buttons removed from Pipeline view */}
                        </TableCell>
                      </TableRow>;
                })}
                  {filteredTasks.length === 0 && <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No se encontraron tareas
                      </TableCell>
                    </TableRow>}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de equipo */}
      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestionar equipo</DialogTitle>
            <DialogDescription>Añade o elimina miembros del equipo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <form onSubmit={addPerson} className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={personForm.name} onChange={e => setPersonForm(f => ({
                ...f,
                name: e.target.value
              }))} required />
              </div>
              <div>
                <Label>Rol</Label>
                <Input value={personForm.role} onChange={e => setPersonForm(f => ({
                ...f,
                role: e.target.value
              }))} />
              </div>
              <div>
                <Label>Color</Label>
                <Input type="color" value={personForm.color} onChange={e => setPersonForm(f => ({
                ...f,
                color: e.target.value
              }))} />
              </div>
              <Button type="submit">Añadir persona</Button>
            </form>

            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-3 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Miembro</span>
                <span>Usuario</span>
                <span>Email</span>
                <span />
              </div>
              {people.map(p => {
                const linkedProfile = p.user_id ? linkedProfiles[p.user_id] : null;
                return (
                  <div key={p.id} className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-3 rounded border p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-4 w-4 rounded shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.role}</div>
                      </div>
                    </div>
                    <div className="min-w-0 text-sm truncate">
                      {p.user_id ? (linkedProfile?.full_name || 'Vinculado') : 'Sin vincular'}
                    </div>
                    <div className="min-w-0 text-sm truncate text-muted-foreground">
                      {p.user_id ? (linkedProfile?.email || 'Sin email') : '—'}
                    </div>
                    <Button variant="destructive" size="icon" onClick={() => deletePerson(p.id)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {people.length === 0 && <div className="text-sm text-muted-foreground">Sin personas aún</div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de incidencia (desde Seguimiento diario) */}
      <IncidentDetailDialog
        open={incidentDetailsOpen}
        onOpenChange={(o) => { 
          if (!o) preserveScroll();
          setIncidentDetailsOpen(o); 
          if (!o) { setSelectedIncidentId(null); } 
        }}
        incidentId={selectedIncidentId}
        onPatched={(id, payload) => {
          setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i));
          // Reload daily tasks to reflect assignment/status sync immediately
          preserveScroll();
          loadTasks(date);
        }}
      />
    </div>);
}
