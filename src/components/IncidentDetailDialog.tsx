import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TaskAssignmentsManager from '@/components/TaskAssignmentsManager';
import { syncSingleAssignmentStatus } from '@/hooks/useSyncTaskStatus';
import { useTaskAssignments } from '@/hooks/useTaskAssignments';
import { recordIncidentStatusChange } from '@/lib/incidentActivityLog';
import { INTERNAL_TASK_ID_MARKER, cleanInternalTaskIdMarker } from '@/lib/internalTaskIds';

// Options same as IncidentsModule to keep UI identical
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'WIP' },
  { value: 'in_qa', label: 'En QA' },
  { value: 'resolved', label: 'En PRO' },
  { value: 'closed', label: 'Cerrada' },
] as const;

const STATUS_BADGE_CLS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
  in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
  resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  closed: 'bg-destructive text-destructive-foreground',
};

const CATEGORY_OPTIONS = [
  { value: 'incident', label: 'Incidencia' },
  { value: 'improvement', label: 'Evolutivo' },
  { value: 'corrective_improvement', label: 'Mejora correctiva' },
] as const;

const ENV_OPTIONS = ['DEV','PRE','PRO','Otro'] as const;
const DEVICE_OPTIONS = ['Web','APP','Otro'] as const;

const MADRID_TIME_ZONE = 'Europe/Madrid';

const mapIncidentStatusToTaskStatus = (status: string): 'pending' | 'in_progress' | 'resolved' => {
  if (status === 'closed') return 'resolved';
  if (status === 'in_qa') return 'in_progress';
  return status as 'pending' | 'in_progress' | 'resolved';
};

const formatManualId = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/\D/g, '').slice(0, 6);

const CORRECTIVE_CATEGORY_MARKER = '[tipo:mejora_correctiva]';

const cleanAdditionalComments = (value: string | null | undefined) =>
  cleanInternalTaskIdMarker(String(value ?? '').replace(CORRECTIVE_CATEGORY_MARKER, '')).trim();

const getDisplayCategory = (incident: { category?: string | null; additional_comments?: string | null }) => {
  if (incident.category === 'corrective_improvement' || String(incident.additional_comments ?? '').includes(CORRECTIVE_CATEGORY_MARKER)) {
    return 'corrective_improvement';
  }
  return incident.category || 'incident';
};

const serializeCategory = (category: string, additionalComments: string | null | undefined) => {
  const cleanComments = cleanAdditionalComments(additionalComments);
  const internalMarker = String(additionalComments ?? '').includes(INTERNAL_TASK_ID_MARKER) ? INTERNAL_TASK_ID_MARKER : '';
  if (category === 'corrective_improvement') {
    return {
      category: 'improvement',
      additional_comments: [CORRECTIVE_CATEGORY_MARKER, internalMarker, cleanComments].filter(Boolean).join('\n')
    };
  }
  return { category, additional_comments: [internalMarker, cleanComments].filter(Boolean).join('\n') };
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

function useSignedUrl(bucket: string) {
  const cache = useRef(new Map<string, string>());
  const getUrl = async (path: string | null | undefined) => {
    if (!path) return null;
    if (cache.current.has(path)) return cache.current.get(path)!;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) return null;
    cache.current.set(path, data.signedUrl);
    return data.signedUrl;
  };
  return { getUrl };
}

interface IncidentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidentId: string | null;
  onPatched?: (id: string, payload: any) => void;
  onDeleted?: (id: string) => void;
}

export default function IncidentDetailDialog({ open, onOpenChange, incidentId, onPatched, onDeleted }: IncidentDetailDialogProps) {
  const { user } = useAuth();
  const { getUrl } = useSignedUrl('project-files');
  const { toast } = useToast();
  const { assignments } = useTaskAssignments(incidentId);

  const [selected, setSelected] = useState<any | null>(null);
  const [createdByEmail, setCreatedByEmail] = useState<string>('');
  const [assignedToName, setAssignedToName] = useState<string>('');
  const [detailEvidenceFile, setDetailEvidenceFile] = useState<File | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const isInitialDetailLoad = useRef(true);
  const [detailForm, setDetailForm] = useState({
    incidentNumber: '',
    name: '',
    description: '',
    occurredAt: new Date().toISOString(),
    status: 'pending',
    category: 'incident',
    epic: '',
    additionalComments: '',
    env: '',
    dev: '',
    evidenceLink: '',
    assignedTo: '',
  });
  const [epicOptions, setEpicOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    const loadEpics = async () => {
      const { data } = await supabase.from('incidents').select('epic').not('epic','is', null);
      const uniq = Array.from(new Set((data || []).map((d: any) => d.epic).filter(Boolean)));
      setEpicOptions(uniq as string[]);
    };
    const loadTeamMembers = async () => {
      // Extract project ID from incident (we need to get it first)
      if (incidentId) {
        const { data: incident } = await supabase.from('incidents').select('project_id').eq('id', incidentId).single();
        if (incident) {
          const { data: members } = await supabase.from('people').select('*').eq('project_id', incident.project_id).order('name', { ascending: true });
          setTeamMembers(members || []);
        }
      }
    };
    loadEpics();
    loadTeamMembers();
  }, [open, incidentId]);

  const resetState = () => {
    setSelected(null);
    setCreatedByEmail('');
    setAssignedToName('');
    setComments([]);
    setCommentText('');
    setDetailEvidenceFile(null);
    isInitialDetailLoad.current = true;
    setDetailForm({
      incidentNumber: '', name: '', description: '', occurredAt: new Date().toISOString(), status: 'pending', category: 'incident', epic: '', additionalComments: '', env: '', dev: '', evidenceLink: '', assignedTo: 'unassigned'
    });
  };

  useEffect(() => {
    if (!open) { resetState(); return; }
    if (!incidentId) return;
    const fetchIncident = async () => {
      const { data } = await supabase.from('incidents').select('*').eq('id', incidentId).single();
      if (data) {
        setSelected(data);
        
        // Get creator name and email if available
        if (data.created_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', data.created_by)
            .maybeSingle();
          
          if (profile) {
            const name = profile.full_name || 'Usuario registrado';
            setCreatedByEmail(profile.email ? `${name} (${profile.email})` : name);
          } else {
            setCreatedByEmail('Usuario registrado');
          }
        }
        
        // Get assigned person name
        if (data.assigned_to) {
          const { data: assignedPerson } = await supabase
            .from('people')
            .select('name')
            .eq('id', data.assigned_to)
            .single();
          setAssignedToName(assignedPerson?.name || 'Usuario asignado');
        }
        
        const pick = (raw: string, allowed: readonly string[]) =>
          (raw || '').split(',').map((s) => s.trim()).find((v) => (allowed as readonly string[]).includes(v)) || '';
        setDetailForm({
          incidentNumber: formatManualId(data.incident_number),
          name: data.name || '',
          description: data.description || '',
          occurredAt: data.occurred_at ? new Date(data.occurred_at).toISOString() : new Date().toISOString(),
          status: data.status || 'pending',
          category: getDisplayCategory(data),
          epic: data.epic || '',
          additionalComments: cleanAdditionalComments(data.additional_comments),
          env: pick(data.environment || '', ENV_OPTIONS),
          dev: pick(data.device || '', DEVICE_OPTIONS),
          evidenceLink: data.evidence && !String(data.evidence).startsWith('incidents/') ? data.evidence : '',
          assignedTo: data.assigned_to || 'unassigned',
        });
        const { data: cmts } = await supabase.from('incident_comments').select('*').eq('incident_id', data.id).order('created_at', { ascending: true });
        setComments(cmts || []);
        isInitialDetailLoad.current = false;
      }
    };
    fetchIncident();
  }, [open, incidentId]);

  const handleUploadEvidence = async (incidentId: string, file?: File) => {
    const fileToUpload = file || detailEvidenceFile;
    if (!fileToUpload) return null;
    const ext = fileToUpload.name.split('.').pop();
    const filePath = `incidents/${incidentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('project-files').upload(filePath, fileToUpload);
    if (error) throw error;
    return filePath;
  };

  useEffect(() => {
    if (!open || !selected) return;
    if (isInitialDetailLoad.current) return;
    const handler = setTimeout(async () => {
      const manualIncidentNumber = formatManualId(detailForm.incidentNumber);
      if (!manualIncidentNumber) return;
      const categoryPayload = serializeCategory(
        detailForm.category,
        [
          String(selected.additional_comments ?? '').includes(INTERNAL_TASK_ID_MARKER) ? INTERNAL_TASK_ID_MARKER : '',
          detailForm.additionalComments,
        ].filter(Boolean).join('\n'),
      );
      const payload: any = {
        incident_number: Number(manualIncidentNumber),
        name: detailForm.name,
        description: detailForm.description,
        environment: detailForm.env,
        device: detailForm.dev,
        occurred_at: new Date(detailForm.occurredAt).toISOString(),
        status: detailForm.status,
        category: categoryPayload.category,
        additional_comments: categoryPayload.additional_comments,
        epic: detailForm.epic,
        evidence: selected.evidence,
        assigned_to: detailForm.assignedTo === 'unassigned' ? null : detailForm.assignedTo,
      };
      if (detailEvidenceFile) {
        try {
          const path = await handleUploadEvidence(selected.id);
          payload.evidence = path;
          setDetailEvidenceFile(null);
        } catch (e) {
          console.error('Error uploading file:', e);
        }
      }
      const previousStatus = selected.status;
      await supabase.from('incidents').update(payload).eq('id', selected.id);
      if (previousStatus !== payload.status) {
        await recordIncidentStatusChange({
          projectId: selected.project_id,
          incidentId: selected.id,
          incidentNumber: Number(payload.incident_number),
          incidentName: payload.name,
          incidentCategory: payload.category,
          fromStatus: previousStatus,
          toStatus: payload.status,
        });
      }
      
      // Sync single-person assignment state if the incident status changed.
      if (payload.status !== selected.status) {
        await syncSingleAssignmentStatus(selected.id, payload.status);
      }

      await supabase
        .from('tasks')
        .update({
          title: payload.name,
          description: payload.description || null,
          related_ticket: manualIncidentNumber,
          status: mapIncidentStatusToTaskStatus(payload.status)
        } as any)
        .eq('incident_id', selected.id)
        .eq('is_auto_linked', true);
      
      setSelected((prev: any) => (prev ? { ...prev, ...payload } : prev));
      onPatched?.(selected.id, payload);
    }, 500);
    return () => clearTimeout(handler);
  }, [detailForm, selected, detailEvidenceFile, open]);

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !user || !commentText.trim()) return;
    const { error } = await supabase.from('incident_comments').insert({ incident_id: selected.id, user_id: user.id, user_email: user.email, content: commentText.trim() });
    if (!error) {
      setCommentText('');
      const { data: cmts } = await supabase.from('incident_comments').select('*').eq('incident_id', selected.id).order('created_at', { ascending: true });
      setComments(cmts || []);
    }
  };

  const handleDelete = async () => {
    if (!selected || !selected.id) return;
    
    if (!confirm(`¿Estás seguro de que quieres eliminar la tarea ${selected.incident_number ?? 'sin ID'}?`)) {
      return;
    }
    
    try {
      const { error: linkedTasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('incident_id', selected.id);

      if (linkedTasksError) throw linkedTasksError;

      const { error } = await supabase
        .from('incidents')
        .delete()
        .eq('id', selected.id);
      
      if (error) throw error;
      
      toast({ title: 'Tarea eliminada', description: 'La tarea ha sido eliminada correctamente' });
      onDeleted?.(selected.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting incident:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar la tarea', variant: 'destructive' });
    }
  };

  const handleCopyInfo = () => {
    if (!selected) return;

    const status = STATUS_OPTIONS.find(s => s.value === selected.status)?.label || selected.status;
    const category = CATEGORY_OPTIONS.find(c => c.value === selected.category)?.label || selected.category;
    
    const info = `ID: ${selected.incident_number ?? 'Sin ID'}
Nombre: ${selected.name || 'Sin nombre'}
Categoría: ${category}
Estado: ${status}
Fecha: ${new Date(selected.occurred_at).toLocaleDateString()}
Entorno: ${selected.environment || 'N/A'}
Canal: ${selected.device || 'N/A'}
Épica: ${selected.epic || 'N/A'}
Descripción: ${selected.description || 'Sin descripción'}
Comentarios adicionales: ${selected.additional_comments || 'N/A'}`;

    navigator.clipboard.writeText(info).then(() => {
      toast({ title: 'Información copiada', description: 'La información ha sido copiada al portapapeles' });
    }).catch(() => {
      toast({ title: 'Error', description: 'No se pudo copiar la información', variant: 'destructive' });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selected ? `Detalle ${selected.incident_number ?? 'sin ID'}` : 'Detalle de incidencia'}
            {selected && (
              <>
                <Button variant="ghost" size="sm" onClick={handleCopyInfo} className="p-1" title="Copiar info">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive p-1" title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {selected && (
              <div className="mt-2 text-sm space-y-1">
                <div><span className="font-medium">Creado por:</span> {createdByEmail || 'Desconocido'}</div>
                {assignedToName && <div><span className="font-medium">Asignado a:</span> {assignedToName}</div>}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        {selected && (
          <div className="space-y-4 overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Nombre</Label>
                <Input value={detailForm.name} onChange={(e) => setDetailForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>ID</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Máx. 6 dígitos"
                  value={detailForm.incidentNumber}
                  onChange={(e) => setDetailForm((f) => ({ ...f, incidentNumber: formatManualId(e.target.value) }))}
                  required
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select 
                  value={detailForm.status} 
                  onValueChange={(v) => setDetailForm((f) => ({ ...f, status: v }))}
                  disabled={assignments.length > 1}
                >
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
                {assignments.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estado calculado automáticamente según las asignaciones
                  </p>
                )}
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={detailForm.category} onValueChange={(v) => setDetailForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Épica</Label>
                <Input list="epic-suggestions" placeholder="Escribe o selecciona..." value={detailForm.epic} onChange={(e) => setDetailForm((f) => ({ ...f, epic: e.target.value }))} />
                <datalist id="epic-suggestions">
                  {epicOptions.map((opt) => (<option key={opt} value={opt} />))}
                </datalist>
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="datetime-local" value={getMadridDateTimeLocal(detailForm.occurredAt)} onChange={(e) => setDetailForm((f) => ({ ...f, occurredAt: madridDateTimeLocalToIso(e.target.value) }))} />
              </div>
              <div>
                <Label>Entorno</Label>
                <Select value={detailForm.env} onValueChange={(v) => setDetailForm((f) => ({ ...f, env: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {ENV_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={detailForm.dev} onValueChange={(v) => setDetailForm((f) => ({ ...f, dev: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Personas asignadas</Label>
                <TaskAssignmentsManager 
                  taskId={selected?.id} 
                  teamMembers={teamMembers}
                  onAssignmentsChange={async () => {
                    // Refrescar datos de la tarea
                    if (selected?.id) {
                      const { data } = await supabase.from('incidents').select('*').eq('id', selected.id).single();
                      if (data) {
                        setSelected(data);
                        // Actualizar también el formulario para reflejar el nuevo estado
                        setDetailForm(prev => ({
                          ...prev,
                          status: data.status
                        }));
                        onPatched?.(selected.id, data);
                      }
                    }
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={detailForm.description} onChange={(e) => setDetailForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Evidencia (archivo)</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => setDetailEvidenceFile(e.target.files?.[0] ?? null)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Evidencia actual</Label>
                <div>
                  {selected.evidence && String(selected.evidence).startsWith('incidents/') ? (
                    <a className="text-primary underline" href="#" onClick={async (e) => { e.preventDefault(); const url = await getUrl(selected.evidence); if (url) window.open(url, '_blank'); }}>Ver archivo</a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="text-xs text-muted-foreground">Comentarios</Label>
              <div className="space-y-3 max-h-48 overflow-auto mt-2 pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">{(c.user_email || 'Anónimo')} • {new Date(c.created_at).toLocaleString()}</div>
                    <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                  </div>
                ))}
                {comments.length === 0 && (<div className="text-sm text-muted-foreground">Sin comentarios aún</div>)}
              </div>
              <form onSubmit={addComment} className="mt-3 flex gap-2">
                <Input placeholder="Escribe un comentario..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                <Button type="submit" disabled={!user}>Enviar</Button>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
