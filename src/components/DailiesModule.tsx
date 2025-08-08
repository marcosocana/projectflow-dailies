import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useProjectAccess } from '@/hooks/useProjectAccess';

interface DailiesModuleProps {
  projectId: string;
  initiallyUnlocked?: boolean;
}

export default function DailiesModule({ projectId, initiallyUnlocked = false }: DailiesModuleProps) {
  const { toast } = useToast();
  const { accessDailies } = useProjectAccess();
  const [unlocked, setUnlocked] = useState<boolean>(initiallyUnlocked);
  const [pass, setPass] = useState('');

  // Sync when parent unlocks via modal
  useEffect(() => {
    if (initiallyUnlocked) setUnlocked(true);
  }, [initiallyUnlocked]);

  const [date, setDate] = useState<Date>(new Date());
  const [dailyId, setDailyId] = useState<string | null>(null);

  const [people, setPeople] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);

  const [personForm, setPersonForm] = useState({ name: '', role: '', color: '#3B82F6' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', personId: '', incidentId: '' });

  const loadBaseData = async () => {
    const [{ data: ppl }, { data: incs }] = await Promise.all([
      supabase.from('people').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('incidents').select('id,name').eq('project_id', projectId).order('created_at', { ascending: false })
    ]);
    setPeople(ppl || []);
    setIncidents(incs || []);
  };

  const ensureDaily = async (d: Date) => {
    const isoDate = d.toISOString().slice(0, 10);
    const { data, error } = await supabase.from('dailies').select('*').eq('project_id', projectId).eq('date', isoDate).maybeSingle();
    if (error) throw error;
    if (data) return data.id as string;
    const { data: created, error: insertErr } = await supabase.from('dailies').insert({ project_id: projectId, date: isoDate }).select().single();
    if (insertErr) throw insertErr;
    return created.id as string;
  };

  const loadTasks = async (d: Date) => {
    const id = await ensureDaily(d);
    setDailyId(id);
    const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId).eq('daily_id', id).order('created_at', { ascending: true });
    if (!error) setTasks(data || []);
  };

  useEffect(() => { if (unlocked) { loadBaseData(); loadTasks(date); } }, [unlocked, projectId, date]);

  const onUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await accessDailies(projectId, pass);
      setUnlocked(true);
    } catch {}
  };

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('people').insert({
      name: personForm.name,
      role: personForm.role,
      color: personForm.color,
      project_id: projectId,
    });
    if (error) return toast({ title: 'Error', description: 'No se pudo crear la persona', variant: 'destructive' });
    setPersonForm({ name: '', role: '', color: '#3B82F6' });
    loadBaseData();
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyId) return;
    const payload: any = {
      title: taskForm.title,
      description: taskForm.description || null,
      project_id: projectId,
      daily_id: dailyId,
      person_id: taskForm.personId || null,
      incident_id: taskForm.incidentId || null,
    };
    const { error } = await supabase.from('tasks').insert(payload);
    if (error) return toast({ title: 'Error', description: 'No se pudo crear la tarea', variant: 'destructive' });
    setTaskForm({ title: '', description: '', personId: '', incidentId: '' });
    loadTasks(date);
  };

  const toggleTask = async (task: any) => {
    const { error } = await supabase.from('tasks').update({ is_completed: !task.is_completed }).eq('id', task.id);
    if (!error) setTasks((t) => t.map((x) => (x.id === task.id ? { ...x, is_completed: !x.is_completed } : x)));
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) setTasks((t) => t.filter((x) => x.id !== id));
  };

  if (!unlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso a Dailies</CardTitle>
          <CardDescription>Introduce la contraseña especial de dailies</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onUnlock} className="flex gap-2 max-w-md">
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña de dailies" required />
            <Button type="submit">Acceder</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendario</CardTitle>
          <CardDescription>Selecciona un día para gestionar</CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="rounded-md border" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Equipo</CardTitle>
            <CardDescription>Personas del proyecto</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addPerson} className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={personForm.name} onChange={(e) => setPersonForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <Label>Rol</Label>
                <Input value={personForm.role} onChange={(e) => setPersonForm((f) => ({ ...f, role: e.target.value }))} />
              </div>
              <div>
                <Label>Color</Label>
                <Input type="color" value={personForm.color} onChange={(e) => setPersonForm((f) => ({ ...f, color: e.target.value }))} />
              </div>
              <Button type="submit">Añadir persona</Button>
            </form>

            <div className="mt-6 space-y-2">
              {people.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded border p-2">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded" style={{ backgroundColor: p.color }} />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.role}</div>
                    </div>
                  </div>
                </div>
              ))}
              {people.length === 0 && <div className="text-sm text-muted-foreground">Sin personas aún</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tareas del día</CardTitle>
            <CardDescription>Crear y gestionar tareas</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addTask} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Título</Label>
                <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <Label>Persona</Label>
                <Select value={taskForm.personId || 'none'} onValueChange={(v) => setTaskForm((f) => ({ ...f, personId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {people.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label>Vincular a incidencia</Label>
                <Select value={taskForm.incidentId || 'none'} onValueChange={(v) => setTaskForm((f) => ({ ...f, incidentId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna</SelectItem>
                    {incidents.map((i) => (<SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Añadir tarea</Button>
              </div>
            </form>

            <Table className="mt-6">
              <TableHeader>
                <TableRow>
                  <TableHead>Hecha</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Incidencia</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const person = people.find((p) => p.id === t.person_id);
                  const inc = incidents.find((i) => i.id === t.incident_id);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox checked={t.is_completed} onCheckedChange={() => toggleTask(t)} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.title}</div>
                        {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                      </TableCell>
                      <TableCell>
                        {person ? (
                          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ backgroundColor: person.color }} />{person.name}</div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {inc ? inc.name : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => deleteTask(t.id)}>Eliminar</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Sin tareas para este día</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
