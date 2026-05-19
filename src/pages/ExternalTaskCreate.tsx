import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2 } from 'lucide-react';
import vecturaLogo from '@/assets/vectura-logo.png';
import TaskAssignmentsInput, { type TaskAssignment } from '@/components/TaskAssignmentsInput';
import type { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];

const ENV_OPTIONS = ['DEV', 'PRE', 'PRO', 'Otro', 'N/A'] as const;
const DEVICE_OPTIONS = ['APP', 'Web', 'Otro', 'N/A'] as const;

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'in_qa', label: 'En pruebas' },
  { value: 'resolved', label: 'Resuelta' },
  { value: 'closed', label: 'Cerrada' }
];

const CATEGORY_OPTIONS = [
  { value: 'incident', label: 'Incidencia' },
  { value: 'improvement', label: 'Evolutivo' },
  { value: 'corrective_improvement', label: 'Mejora correctiva' }
];

const CORRECTIVE_CATEGORY_MARKER = '[tipo:mejora_correctiva]';

const serializeCategory = (category: string, additionalComments = '') => {
  if (category === 'corrective_improvement') {
    return {
      category: 'improvement',
      additional_comments: [CORRECTIVE_CATEGORY_MARKER, additionalComments.trim()].filter(Boolean).join('\n')
    };
  }
  return { category, additional_comments: additionalComments.trim() };
};

const STATUS_BADGE_CLS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
  in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
  resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  closed: 'bg-destructive text-destructive-foreground'
};

const MADRID_TIME_ZONE = 'Europe/Madrid';

const formatManualId = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/\D/g, '').slice(0, 6);

const getMadridDateTimeLocal = (value: string | Date = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

const madridDateTimeLocalToIso = (value: string) => {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const targetMadridMinutes = Date.UTC(year, month - 1, day, hour, minute) / 60000;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const madridGuess = getMadridDateTimeLocal(utcGuess);
  const [guessDate, guessTime] = madridGuess.split('T');
  const [guessYear, guessMonth, guessDay] = guessDate.split('-').map(Number);
  const [guessHour, guessMinute] = guessTime.split(':').map(Number);
  const guessMadridMinutes = Date.UTC(guessYear, guessMonth - 1, guessDay, guessHour, guessMinute) / 60000;
  return new Date(utcGuess.getTime() + (targetMadridMinutes - guessMadridMinutes) * 60000).toISOString();
};

export default function ExternalTaskCreate() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [availableEpics, setAvailableEpics] = useState<string[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [createDailyTasks, setCreateDailyTasks] = useState(true);
  
  const [form, setForm] = useState({
    incidentNumber: '',
    name: '',
    description: '',
    environment: 'N/A',
    device: 'N/A',
    epic: '',
    occurredAt: new Date().toISOString(),
    status: 'pending',
    category: 'incident'
  });

  useEffect(() => {
    document.title = 'Crear tarea - Vectorea';
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Obtener el primer proyecto (o puedes hacer que sea configurable)
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .limit(1);

      if (projectError) throw projectError;
      
      if (projects && projects.length > 0) {
        const currentProjectId = projects[0].id;
        setProjectId(currentProjectId);

        // Cargar miembros del equipo
        const { data: people, error: peopleError } = await supabase
          .from('people')
          .select('*')
          .eq('project_id', currentProjectId)
          .order('name', { ascending: true });

        if (peopleError) throw peopleError;
        setTeamMembers(people || []);

        // Obtener épicas disponibles
        const { data: incidents, error: incidentsError } = await supabase
          .from('incidents')
          .select('epic')
          .eq('project_id', currentProjectId)
          .not('epic', 'is', null);

        if (!incidentsError && incidents) {
          const epics = [...new Set(incidents.map(i => i.epic).filter(Boolean))].sort();
          setAvailableEpics(epics as string[]);
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información inicial',
        variant: 'destructive'
      });
    }
  };

  const handleUploadEvidence = async (incidentId: string) => {
    if (!evidenceFile) return null;
    const ext = evidenceFile.name.split('.').pop();
    const filePath = `incidents/${incidentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('project-files')
      .upload(filePath, evidenceFile);
    
    if (error) throw error;
    return filePath;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectId) {
      toast({
        title: 'Error',
        description: 'No se pudo determinar el proyecto',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const id = crypto.randomUUID();
      const incidentNumber = formatManualId(form.incidentNumber);

      if (!incidentNumber) {
        toast({
          title: 'ID obligatorio',
          description: 'Completa el ID de la tarea con un número de hasta 6 dígitos.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      const categoryPayload = serializeCategory(form.category);
      const insertPayload: any = {
        id,
        incident_number: Number(incidentNumber),
        name: form.name,
        description: form.description,
        environment: form.environment,
        device: form.device,
        epic: form.epic,
        occurred_at: new Date(form.occurredAt).toISOString(),
        status: form.status,
        category: categoryPayload.category,
        additional_comments: categoryPayload.additional_comments,
        project_id: projectId,
        assigned_to: null
      };

      if (evidenceFile) {
        const path = await handleUploadEvidence(id);
        insertPayload.evidence = path;
      }

      const { error } = await supabase
        .from('incidents')
        .insert(insertPayload);

      if (error) throw error;

      // Create multiple assignments
      if (assignments.length > 0) {
        const assignmentsToInsert = assignments.map(a => ({
          incident_id: id,
          assigned_to: a.person,
          status: a.status
        }));
        await supabase.from('incident_assignments').insert(assignmentsToInsert);
        
        // Sync overall task status based on assignments
        const { updateTaskStatusFromAssignments } = await import('@/hooks/useSyncTaskStatus');
        await updateTaskStatusFromAssignments(id);

        // Create daily tasks if checkbox is enabled
        if (createDailyTasks) {
          const today = new Date().toISOString().split('T')[0];
          
          // Get or create today's daily
          let { data: daily, error: dailyError } = await supabase
            .from('dailies')
            .select('id')
            .eq('project_id', projectId)
            .eq('date', today)
            .single();

          if (dailyError && dailyError.code === 'PGRST116') {
            // Daily doesn't exist, create it
            const { data: newDaily, error: createError } = await supabase
              .from('dailies')
              .insert({ project_id: projectId, date: today, content: {} })
              .select('id')
              .single();
            
            if (createError) throw createError;
            daily = newDaily;
          } else if (dailyError) {
            throw dailyError;
          }

          if (daily) {
            // Create a task in the tasks table for each assignment
            const tasksToInsert = assignments.map(a => {
              const taskStatus: 'pending' | 'in_progress' | 'resolved' = 
                a.status === 'resolved' || a.status === 'closed' ? 'resolved' : 
                a.status === 'in_progress' || a.status === 'in_qa' ? 'in_progress' : 
                'pending';

              return {
                title: form.name,
                description: form.description,
                project_id: projectId,
                incident_id: id,
                person_id: a.person,
                assigned_to: a.person,
                status: taskStatus,
                is_auto_linked: true,
                related_ticket: incidentNumber
              };
            });

            const { data: createdTasks, error: tasksError } = await supabase
              .from('tasks')
              .insert(tasksToInsert)
              .select('id');

            if (tasksError) throw tasksError;

            // Link tasks with the daily
            if (createdTasks && createdTasks.length > 0) {
              const dailyTasksToInsert = createdTasks.map(task => ({
                daily_id: daily.id,
                task_id: task.id
              }));

              const { error: dailyTasksError } = await supabase
                .from('daily_tasks')
                .insert(dailyTasksToInsert);

              if (dailyTasksError) throw dailyTasksError;
            }
          }
        }
      }

      toast({
        title: 'Tarea creada',
        description: `La tarea "${form.name}" se ha creado exitosamente.`
      });

      // Reset form
      setForm({
        incidentNumber: '',
        name: '',
        description: '',
        environment: 'N/A',
        device: 'N/A',
        epic: '',
        occurredAt: new Date().toISOString(),
        status: 'pending',
        category: 'incident'
      });
      setEvidenceFile(null);
      setAssignments([]);
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la tarea',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white h-[64px] flex items-center px-6">
        <div className="flex items-center gap-2">
          <img src={vecturaLogo} alt="Vectorea" className="h-10 w-auto object-contain" />
          <h1 className="text-2xl font-bold">Vectorea</h1>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Crear nueva tarea</CardTitle>
            <CardDescription>
              Completa la información de la tarea. La tarea será asignada automáticamente a Marcos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID *</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Máx. 6 dígitos"
                  value={form.incidentNumber}
                  onChange={e => setForm(f => ({ ...f, incidentNumber: formatManualId(e.target.value) }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input 
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  required 
                  placeholder="Nombre de la tarea"
                />
              </div>

              <div className="space-y-2">
                <Label>Entorno</Label>
                <Select 
                  value={form.environment} 
                  onValueChange={v => setForm(f => ({ ...f, environment: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {ENV_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Canal</Label>
                <Select 
                  value={form.device} 
                  onValueChange={v => setForm(f => ({ ...f, device: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Épica</Label>
                <Select 
                  value={form.epic} 
                  onValueChange={v => setForm(f => ({ ...f, epic: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {availableEpics.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha (España)</Label>
                <Input 
                  type="datetime-local" 
                  value={getMadridDateTimeLocal(form.occurredAt)} 
                  onChange={e => {
                    setForm(f => ({ ...f, occurredAt: madridDateTimeLocalToIso(e.target.value) }));
                  }} 
                />
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={form.status} 
                  onValueChange={v => setForm(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`${STATUS_BADGE_CLS[s.value] || 'bg-accent text-accent-foreground'} border-transparent text-[10px] px-1 py-0.5`}
                          >
                            {s.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select 
                  value={form.category} 
                  onValueChange={v => setForm(f => ({ ...f, category: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Personas asignadas (opcional)</Label>
                <TaskAssignmentsInput 
                  teamMembers={teamMembers}
                  assignments={assignments}
                  onAssignmentsChange={setAssignments}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="createDailyTasks" 
                    checked={createDailyTasks}
                    onCheckedChange={(checked) => setCreateDailyTasks(checked as boolean)}
                  />
                  <Label 
                    htmlFor="createDailyTasks" 
                    className="text-sm font-normal cursor-pointer"
                  >
                    Crear tareas en el seguimiento diario
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Se creará una tarea en el seguimiento interno para cada miembro asignado, vinculada con esta tarea y en el día actual.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="Describe la tarea..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Evidencia (archivo)</Label>
                <Input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)} 
                />
              </div>

              <div className="md:col-span-2 flex gap-2 justify-end">
                <Button type="submit" disabled={loading} className="flex items-center gap-2">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                  ) : (
                    <><Plus className="h-4 w-4" /> Crear tarea</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
