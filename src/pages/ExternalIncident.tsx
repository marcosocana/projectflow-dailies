import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

const ENV_OPTIONS = ['Desarrollo', 'Testing', 'Preproducción', 'Producción'];
const DEVICE_OPTIONS = ['Web', 'Mobile', 'Aplicación'];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'resolved', label: 'Resuelta' },
  { value: 'closed', label: 'Cerrada' },
];

const CATEGORY_OPTIONS = [
  { value: 'incident', label: 'Incidencia' },
  { value: 'improvement', label: 'Evolutivo' },
  { value: 'corrective_improvement', label: 'Mejora correctiva' },
];

const STATUS_BADGE_CLS = {
  pending: 'bg-warning text-warning-foreground',
  in_progress: 'bg-info text-info-foreground', 
  resolved: 'bg-success text-success-foreground',
  closed: 'bg-destructive text-destructive-foreground',
} as const;

const MADRID_TIME_ZONE = 'Europe/Madrid';

const formatManualId = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/\D/g, '').slice(0, 6);

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

export default function ExternalIncident() {
  const projectId = new URLSearchParams(window.location.search).get('project');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [project, setProject] = useState<any>(null);
  const [availableEpics, setAvailableEpics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    incidentNumber: '',
    name: '',
    description: '',
    environment: '',
    device: '',
    epic: '',
    occurredAt: new Date().toISOString(),
    status: 'pending',
    category: 'incident',
    additionalComments: '',
    creatorName: '',
    creatorEmail: '',
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchEpics();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      setProject(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el proyecto',
        variant: 'destructive'
      });
    }
  };

  const fetchEpics = async () => {
    try {
      const { data } = await supabase
        .from('incidents')
        .select('epic')
        .eq('project_id', projectId)
        .not('epic', 'is', null);
      
      const epics = [...new Set(data?.map((i: any) => i.epic).filter(Boolean))];
      setAvailableEpics(epics);
    } catch (error) {
      console.error('Error fetching epics:', error);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setLoading(true);
    try {
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

      let evidenceUrl = null;
      
      // Upload evidence file if present
      if (evidenceFile) {
        const fileName = `${Date.now()}-${evidenceFile.name}`;
        const { data, error } = await supabase.storage
          .from('project-files')
          .upload(fileName, evidenceFile);
        
        if (error) throw error;
        evidenceUrl = data.path;
      }

      const categoryPayload = serializeCategory(
        form.category,
        `${form.additionalComments}\n\nCreado por: ${form.creatorName} (${form.creatorEmail})`
      );

      // Create incident
      const { error } = await supabase.from('incidents').insert({
        project_id: projectId,
        incident_number: Number(incidentNumber),
        name: form.name,
        description: form.description,
        environment: form.environment,
        device: form.device,
        epic: form.epic || null,
        occurred_at: form.occurredAt,
        status: form.status as any,
        category: categoryPayload.category as any,
        additional_comments: categoryPayload.additional_comments,
        evidence: evidenceUrl,
        created_by: null, // External submission
      });

      if (error) throw error;

      toast({
        title: 'Incidencia creada',
        description: 'Tu incidencia ha sido registrada correctamente',
      });

      // Redirect to incidents list
      navigate(`/?project=${projectId}&view=incidents`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la incidencia',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Error: No se especificó el ID del proyecto en la URL</p>
            <p className="text-sm text-muted-foreground mt-2">
              La URL debe incluir el parámetro del proyecto: ?project=ID_DEL_PROYECTO
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Cargando proyecto...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-4">
              {project?.logo_url && (
                <img 
                  src={project.logo_url} 
                  alt={`Logo de ${project.name}`}
                  className="h-12 w-auto object-contain border rounded"
                />
              )}
              <div>
                <CardTitle>Reportar Incidencia</CardTitle>
                <p className="text-muted-foreground">{project.name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del creador *</Label>
                <Input 
                  value={form.creatorName} 
                  onChange={(e) => setForm((f) => ({ ...f, creatorName: e.target.value }))} 
                  required 
                  placeholder="Tu nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Email del creador *</Label>
                <Input 
                  type="email"
                  value={form.creatorEmail} 
                  onChange={(e) => setForm((f) => ({ ...f, creatorEmail: e.target.value }))} 
                  required 
                  placeholder="tu.email@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>ID *</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Máx. 6 dígitos"
                  value={form.incidentNumber}
                  onChange={(e) => setForm((f) => ({ ...f, incidentNumber: formatManualId(e.target.value) }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre de la incidencia *</Label>
                <Input 
                  value={form.name} 
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} 
                  required 
                  placeholder="Describe brevemente el problema"
                />
              </div>
              <div className="space-y-2">
                <Label>Entorno</Label>
                <Select value={form.environment} onValueChange={(v) => setForm((f) => ({ ...f, environment: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar entorno" /></SelectTrigger>
                  <SelectContent>
                    {ENV_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={form.device} onValueChange={(v) => setForm((f) => ({ ...f, device: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar canal" /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Épica</Label>
                <Select value={form.epic} onValueChange={(v) => setForm((f) => ({ ...f, epic: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar épica (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {availableEpics.map((opt) => (
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
                  onChange={(e) => {
                    setForm((f) => ({ ...f, occurredAt: madridDateTimeLocalToIso(e.target.value) }));
                  }} 
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${STATUS_BADGE_CLS[s.value] || 'bg-accent text-accent-foreground'} border-transparent text-[10px] px-1 py-0.5`}>
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
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea 
                  value={form.description} 
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} 
                  placeholder="Describe el problema en detalle"
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Comentarios adicionales</Label>
                <Textarea 
                  value={form.additionalComments} 
                  onChange={(e) => setForm((f) => ({ ...f, additionalComments: e.target.value }))} 
                  placeholder="Información adicional (opcional)"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Evidencia (archivo)</Label>
                <Input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} 
                />
                <p className="text-sm text-muted-foreground">
                  Puedes adjuntar capturas de pantalla o documentos que ayuden a entender el problema
                </p>
              </div>
              <div className="md:col-span-2 flex gap-2 justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> 
                  {loading ? 'Creando...' : 'Crear incidencia'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
