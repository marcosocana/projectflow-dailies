import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { es } from 'date-fns/locale';
import type { TablesInsert } from '@/integrations/supabase/types';
import { Trash2, Eye, Pencil, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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
    personId: string;
    incidentId: string;
    status: TaskStatus;
  }>({
    title: '',
    description: '',
    personId: '',
    incidentId: '',
    status: 'pending'
  });
  // Sync when parent unlocks via modal
  useEffect(() => {
    if (initiallyUnlocked) setUnlocked(true);
  }, [initiallyUnlocked]);
  const [date, setDate] = useState<Date>(new Date());
  const [dailyId, setDailyId] = useState<string | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [personForm, setPersonForm] = useState({
    name: '',
    role: '',
    color: '#3B82F6'
  });
  const [taskForm, setTaskForm] = useState<{
    title: string;
    description: string;
    personId: string;
    incidentId: string;
    status: TaskStatus;
  }>({
    title: '',
    description: '',
    personId: '',
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
    }), supabase.from('incidents').select('id,name').eq('project_id', projectId).order('created_at', {
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
    } = await supabase.from('daily_tasks').select('tasks(*)').eq('daily_id', id);
    if (!error) {
      const list = (data || []).map((r: any) => r.tasks).filter(Boolean);
      list.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
      person_id: taskForm.personId || null,
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
    // Map task to current daily
    await supabase.from('daily_tasks').upsert({
      daily_id: dailyId,
      task_id: created.id
    } as any, {
      onConflict: 'daily_id,task_id'
    } as any);
    setTaskForm({
      title: '',
      description: '',
      personId: '',
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
  const cloneYesterdayTasks = async () => {
    try {
      if (!date) return;
      const todayId = await ensureDaily(date);
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

      // Get task ids from source and map them to today
      const {
        data: toLink
      } = await supabase.from('daily_tasks').select('task_id').eq('daily_id', sourceDailyId);
      const rows = (toLink || []).map((r: any) => ({
        daily_id: todayId,
        task_id: r.task_id
      }));
      if (rows.length) {
        await supabase.from('daily_tasks').upsert(rows as any, {
          onConflict: 'daily_id,task_id'
        } as any);
      }
      await loadTasks(date);
      toast({
        title: 'Tareas persistidas',
        description: 'Se cargaron las tareas del último día con tareas.'
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las tareas del día anterior',
        variant: 'destructive'
      });
    }
  };
  const loadTaskComments = async (taskId: string) => {
    const {
      data
    } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at', {
      ascending: true
    });
    setTaskComments(data || []);
  };
  const openDetails = async (task: any) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      personId: task.person_id || '',
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
        person_id: editForm.personId || null,
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
          <CardTitle>Acceso a Dailies</CardTitle>
          <CardDescription>Introduce la contraseña especial de dailies</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onUnlock} className="flex gap-2 max-w-md">
            <Input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Contraseña de dailies" required />
            <Button type="submit">Acceder</Button>
          </form>
        </CardContent>
      </Card>;
  }
  return <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Calendario</CardTitle>
          
        </CardHeader>
        <CardContent>
          <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} locale={es} className="rounded-md border p-3 pointer-events-auto px-[30px]" />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Tareas del día</CardTitle>
              
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="icon" onClick={() => {
              loadBaseData();
              loadTasks(date);
            }} aria-label="Actualizar" title="Actualizar">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setCreateTaskOpen(true)} aria-label="Crear tarea" title="Crear tarea">+</Button>
              <Button variant="outline" onClick={cloneYesterdayTasks}>Persistir tareas</Button>
              <Button variant="outline" onClick={() => setTeamOpen(true)}>Equipo</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table className="mt-0">
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Incidencia</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(t => {
              const person = people.find(p => p.id === t.person_id);
              const inc = incidents.find(i => i.id === t.incident_id);
              return <TableRow key={t.id}>
                    <TableCell>
                      {t.status === 'in_progress' ? 'En curso' : t.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                    </TableCell>
                    <TableCell>
                      {person ? <div className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{
                      backgroundColor: person.color
                    }} />{person.name}</div> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {inc ? inc.name : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetails(t)} aria-label="Ver"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTask(t.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>;
            })}
              {tasks.length === 0 && <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Sin tareas para este día</TableCell>
                </TableRow>}
            </TableBody>
          </Table>
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
              <Label>Persona</Label>
              <Select value={taskForm.personId || 'none'} onValueChange={v => setTaskForm(f => ({
              ...f,
              personId: v === 'none' ? '' : v
            }))}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Select value={taskForm.incidentId || 'none'} onValueChange={v => setTaskForm(f => ({
              ...f,
              incidentId: v === 'none' ? '' : v
            }))}>
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {incidents.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
                  <Label>Persona</Label>
                  <Select value={editForm.personId || 'none'} onValueChange={v => setEditForm(f => ({
                ...f,
                personId: v === 'none' ? '' : v
              }))}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                  <Select value={editForm.incidentId || 'none'} onValueChange={v => setEditForm(f => ({
                ...f,
                incidentId: v === 'none' ? '' : v
              }))}>
                    <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {incidents.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
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
    </div>;
}