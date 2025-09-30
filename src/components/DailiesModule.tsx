import { useEffect, useMemo, useState } from 'react';
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
import type { TablesInsert } from '@/integrations/supabase/types';
import { Trash2, Eye, Pencil, RefreshCcw, List, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
type TaskStatus = 'pending' | 'in_progress' | 'resolved';
interface DailiesModuleProps {
  projectId: string;
  initiallyUnlocked?: boolean;
}
export default function DailiesModule({
  projectId,
  initiallyUnlocked = false
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
    description: string;
    personIds: string[];
    incidentId: string;
    status: TaskStatus;
  }>({
    title: '',
    description: '',
    personIds: [],
    incidentId: '',
    status: 'pending'
  });

  // New states for persist modal and view all tasks
  const [persistModalOpen, setPersistModalOpen] = useState(false);
  const [lastDayTasks, setLastDayTasks] = useState<any[]>([]);
  const [selectedTasksForPersist, setSelectedTasksForPersist] = useState<string[]>([]);
  const [viewAllTasksOpen, setViewAllTasksOpen] = useState(false);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<'status' | 'title' | 'person'>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Sync when parent unlocks via modal
  useEffect(() => {
    if (initiallyUnlocked) setUnlocked(true);
  }, [initiallyUnlocked]);
  const [date, setDate] = useState<Date>(new Date());
  const [dailyId, setDailyId] = useState<string | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
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
    status: TaskStatus;
  }>({
    title: '',
    description: '',
    personIds: [],
    incidentId: '',
    status: 'pending'
  });
  const loadBaseData = async () => {
    const [{
      data: ppl
    }, {
      data: incs
    }] = await Promise.all([supabase.from('people').select('*').eq('project_id', projectId).order('created_at', {
      ascending: true
    }), supabase.from('incidents').select('id,name,incident_number,status,category').eq('project_id', projectId).order('incident_number', {
      ascending: false
    })]);
    setPeople(ppl || []);
    setIncidents(incs || []);
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
  const loadTasks = async (d: Date) => {
    const id = await ensureDaily(d);
    setDailyId(id);
    const {
      data,
      error
    } = await supabase.from('daily_tasks').select('task_id, order_position, tasks(*)').eq('daily_id', id).order('order_position', { ascending: true });
    if (!error) {
      const list = (data || []).map((r: any) => r.tasks).filter(Boolean);
      setTasks(list);
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
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyId) return;
    const payload: TablesInsert<'tasks'> = {
      title: taskForm.title,
      description: taskForm.description || null,
      project_id: projectId,
      daily_id: dailyId,
      person_id: taskForm.personIds.length > 0 ? taskForm.personIds[0] : null, // For now, use first person
      incident_id: taskForm.incidentId || null,
      status: taskForm.status ?? 'pending'
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
    
    // Map task to current daily with order position
    await supabase.from('daily_tasks').upsert({
      daily_id: dailyId,
      task_id: created.id,
      order_position: nextPosition
    } as any, {
      onConflict: 'daily_id,task_id'
    } as any);
    setTaskForm({
      title: '',
      description: '',
      personIds: [],
      incidentId: '',
      status: 'pending'
    });
    setCreateTaskOpen(false);
    loadTasks(date);
  };
  const toggleTask = async (task: any) => {
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
  const deleteTask = async (id: string) => {
    const {
      error
    } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) setTasks(t => t.filter(x => x.id !== id));
  };
  const openPersistModal = async () => {
    try {
      if (!date) return;
      const todayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      // Find the most recent previous day with tasks
      const {
        data: prevDays
      } = await supabase.from('dailies').select('id, date').eq('project_id', projectId).lt('date', todayStr).order('date', {
        ascending: false
      });
      let sourceDailyId: string | null = null;
      if (prevDays && prevDays.length) {
        for (const d of prevDays) {
          const {
            data: links
          } = await supabase.from('daily_tasks').select('task_id').eq('daily_id', d.id);
          if (links && links.length) {
            sourceDailyId = d.id as string;
            break;
          }
        }
      }
      if (!sourceDailyId) {
        toast({
          title: 'Sin tareas previas',
          description: 'No se encontraron tareas en días anteriores'
        });
        return;
      }

      // Get tasks from the last day with tasks
      const {
        data: taskData
      } = await supabase.from('daily_tasks').select('tasks(*)').eq('daily_id', sourceDailyId);
      const tasks = (taskData || []).map((r: any) => r.tasks).filter(Boolean);
      setLastDayTasks(tasks);
      setSelectedTasksForPersist(tasks.map((t: any) => t.id)); // All selected by default
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
      
      const rows = selectedTasksForPersist
        .filter((taskId) => !existingIds.includes(taskId))
        .map((taskId, index) => ({ 
          daily_id: todayId, 
          task_id: taskId,
          order_position: startPosition + index
        }));

      if (rows.length) {
        const { error: insertErr } = await supabase.from('daily_tasks').insert(rows as any);
        if (insertErr) throw insertErr;
      }

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
            'resolved': 2
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
      filtered = filtered.filter(task => task.title?.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query));
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'status':
          const statusOrder = { 'in_progress': 0, 'pending': 1, 'resolved': 2 };
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

  // Drag and drop functionality
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !dailyId) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Update local state immediately for smooth UX
    const newTasks = arrayMove(tasks, oldIndex, newIndex);
    setTasks(newTasks);

    // Update order_position in database
    try {
      const updates = newTasks.map((task, index) => ({
        daily_id: dailyId,
        task_id: task.id,
        order_position: index,
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
        loadTasks(date);
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el orden',
        variant: 'destructive',
      });
      loadTasks(date);
    }
  };

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

    return (
      <TableRow ref={setNodeRef} style={style} className={isDragging ? 'relative z-50' : ''}>
        <TableCell className="w-8">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </TableCell>
        <TableCell>
          <Badge 
            variant="outline"
            className={
              task.status === 'in_progress' 
                ? 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent'
                : task.status === 'resolved' 
                ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent'
                : 'bg-muted text-muted-foreground border-transparent'
            }
          >
            {task.status === 'in_progress' ? 'En curso' : task.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="font-medium">{task.title}</div>
          {typeof task.description === 'string' && (
            <div className="text-xs text-muted-foreground">
              {task.description.length > 70 ? `${task.description.slice(0, 70)}...` : task.description}
            </div>
          )}
        </TableCell>
        <TableCell>
          {person ? (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded" style={{ backgroundColor: person.color }} />
              {person.name}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {incident ? (
            <Button variant="link" className="px-0" onClick={() => openIncidentDetails(incident.id)}>
              {getTicketCode(incident)}
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => openDetails(task)} 
            aria-label="Ver"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)} aria-label="Eliminar">
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
    const num = incident?.incident_number ?? null;
    if (num === null || num === undefined) return null;
    return `T${String(num).padStart(4, '0')}`;
  };
  const formatIncidentLabel = (incident: any) => {
    const code = getTicketCode(incident);
    return code ? `${code} - ${incident.name}` : incident.name;
  };

  const openIncidentDetails = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setIncidentDetailsOpen(true);
  };


  const openDetails = async (task: any) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      personIds: task.person_id ? [task.person_id] : [],
      incidentId: task.incident_id || '',
      status: task.status as TaskStatus || 'pending'
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
  // Autosave task edits (500ms debounce)
  useEffect(() => {
    if (!selectedTask) return;
    const handler = setTimeout(async () => {
      const update = {
        title: editForm.title,
        description: editForm.description || null,
        person_id: editForm.personIds.length > 0 ? editForm.personIds[0] : null,
        incident_id: editForm.incidentId || null,
        status: editForm.status
      };
      const {
        error
      } = await supabase.from('tasks').update(update).eq('id', selectedTask.id);
      if (!error) {
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Seguimiento diario</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Button onClick={() => setCreateTaskOpen(true)} aria-label="Crear tarea" title="Crear tarea">+</Button>
              <Button variant="outline" onClick={openPersistModal}>Persistir</Button>
              <Button variant="outline" onClick={() => { loadAllTasks(); setViewAllTasksOpen(true); }}>Ver todas</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Calendar */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Calendario</h3>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                locale={es}
                className="rounded-md border p-3 pointer-events-auto w-full mx-auto px-[50px]"
              />
            </div>

            {/* Tasks List */}
            <div className="md:col-span-2">
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
                      <TableHead>Tarea</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Incidencia</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={tasks.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {tasks.map((t) => {
                        const person = people.find((p) => p.id === t.person_id);
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
                    {tasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Sin tareas para este día
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Crear Tarea */}

      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Crear tarea</DialogTitle>
            <DialogDescription>Completa la información de la nueva tarea</DialogDescription>
          </DialogHeader>
          <form onSubmit={addTask} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm(f => ({
              ...f,
              title: e.target.value
            }))} required />
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
              <Select value={taskForm.status} onValueChange={v => setTaskForm(f => ({
              ...f,
              status: v as TaskStatus
            }))}>
                <SelectTrigger><SelectValue placeholder="Pendiente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En curso</SelectItem>
                  <SelectItem value="resolved">Resuelta</SelectItem>
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
            <div className="md:col-span-2">
              <Label>Vincular a incidencia</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {taskForm.incidentId ? 
                      formatIncidentLabel(incidents.find(i => i.id === taskForm.incidentId)!) : 
                      "Ninguna"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar incidencia..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron incidencias.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setTaskForm(f => ({ ...f, incidentId: '' }));
                          }}
                        >
                          Ninguna
                        </CommandItem>
                         {incidents.map(i => (
                           <CommandItem
                             key={i.id}
                             value={formatIncidentLabel(i)}
                             onSelect={() => {
                               setTaskForm(f => ({ ...f, incidentId: i.id }));
                             }}
                           >
                             {formatIncidentLabel(i)}
                           </CommandItem>
                         ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={!dailyId}>Crear</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle de Tarea */}
      <Dialog open={detailsOpen} onOpenChange={o => {
      setDetailsOpen(o);
      if (!o) {
        setSelectedTask(null);
        setEditing(false);
      }
    }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de tarea</DialogTitle>
            <DialogDescription>Ver información completa y comentarios</DialogDescription>
          </DialogHeader>

          {selectedTask && <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Título</Label>
                  <Input value={editForm.title} onChange={e => setEditForm(f => ({
                ...f,
                title: e.target.value
              }))} required />
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
                   <Select value={editForm.status} onValueChange={v => setEditForm(f => ({
                 ...f,
                 status: v as TaskStatus
               }))}>
                     <SelectTrigger><SelectValue placeholder="Pendiente" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="pending">Pendiente</SelectItem>
                       <SelectItem value="in_progress">En curso</SelectItem>
                       <SelectItem value="resolved">Resuelta</SelectItem>
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
                        {editForm.incidentId ? 
                          formatIncidentLabel(incidents.find(i => i.id === editForm.incidentId)!) : 
                          "Ninguna"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar incidencia..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron incidencias.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setEditForm(f => ({ ...f, incidentId: '' }));
                              }}
                            >
                              Ninguna
                            </CommandItem>
                             {incidents.map(i => (
                               <CommandItem
                                 key={i.id}
                                 value={formatIncidentLabel(i)}
                                 onSelect={() => {
                                   setEditForm(f => ({ ...f, incidentId: i.id }));
                                 }}
                               >
                                 {formatIncidentLabel(i)}
                               </CommandItem>
                             ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                const person = people.find(p => p.id === task.person_id);
                const isSelected = selectedTasksForPersist.includes(task.id);
                return <div key={task.id} className="flex items-start gap-3 p-3 border rounded">
                      <Checkbox checked={isSelected} onCheckedChange={checked => {
                    if (checked) {
                      setSelectedTasksForPersist(prev => [...prev, task.id]);
                    } else {
                      setSelectedTasksForPersist(prev => prev.filter(id => id !== task.id));
                    }
                  }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{task.title}</div>
                        {task.description && <div className="text-sm text-muted-foreground mt-1">{task.description}</div>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <Badge 
                            variant="outline"
                            className={
                              task.status === 'in_progress' 
                                ? 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent'
                                : task.status === 'resolved' 
                                ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent'
                                : 'bg-muted text-muted-foreground border-transparent'
                            }
                          >
                            {task.status === 'in_progress' ? 'En curso' : task.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
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
              <Button variant="outline" onClick={() => setSelectedTasksForPersist(lastDayTasks.map(t => t.id))} disabled={lastDayTasks.length === 0}>
                Seleccionar todas
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
                  <SelectItem value="in_progress">En curso</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="resolved">Resuelta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="status">Estado</SortableHeader>
                    <SortableHeader field="title">Tarea</SortableHeader>
                    <SortableHeader field="person">Persona</SortableHeader>
                    <TableHead>Creada</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map(task => {
                  const person = people.find(p => p.id === task.person_id);
                  return <TableRow key={task.id}>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              task.status === 'in_progress' 
                                ? 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent'
                                : task.status === 'resolved' 
                                ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent'
                                : 'bg-muted text-muted-foreground border-transparent'
                            }
                          >
                            {task.status === 'in_progress' ? 'En curso' : task.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
                          </Badge>
                        </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             {task.assigned_to && (
                               <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                             )}
                             <div className="font-medium">{task.title}</div>
                           </div>
                           {typeof task.description === 'string' && <div className="text-xs text-muted-foreground">{task.description.length > 150 ? `${task.description.slice(0, 150)}...` : task.description}</div>}
                         </TableCell>
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
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
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
              {people.map(p => <div key={p.id} className="flex items-center justify-between rounded border p-2">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded" style={{
                  backgroundColor: p.color
                }} />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.role}</div>
                    </div>
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => deletePerson(p.id)} aria-label="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>)}
              {people.length === 0 && <div className="text-sm text-muted-foreground">Sin personas aún</div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de incidencia (desde Seguimiento diario) */}
      <IncidentDetailDialog
        open={incidentDetailsOpen}
        onOpenChange={(o) => { setIncidentDetailsOpen(o); if (!o) { setSelectedIncidentId(null); } }}
        incidentId={selectedIncidentId}
        onPatched={(id, payload) => {
          setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i));
        }}
      />
    </div>);
}