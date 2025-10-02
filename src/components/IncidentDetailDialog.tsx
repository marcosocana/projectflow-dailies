import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Options same as IncidentsModule to keep UI identical
const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'En curso' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_qa', label: 'En pruebas' },
  { value: 'resolved', label: 'Resuelta' },
  { value: 'closed', label: 'Cerrada' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'incident', label: 'Incidencia' },
  { value: 'improvement', label: 'Mejora' },
] as const;

const ENV_OPTIONS = ['DEV','PRE','PRO','Otro'] as const;
const DEVICE_OPTIONS = ['Web','APP','Otro'] as const;

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

  const [selected, setSelected] = useState<any | null>(null);
  const [createdByEmail, setCreatedByEmail] = useState<string>('');
  const [assignedToName, setAssignedToName] = useState<string>('');
  const [detailEvidenceFile, setDetailEvidenceFile] = useState<File | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const isInitialDetailLoad = useRef(true);
  const [detailForm, setDetailForm] = useState({
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
      name: '', description: '', occurredAt: new Date().toISOString(), status: 'pending', category: 'incident', epic: '', additionalComments: '', env: '', dev: '', evidenceLink: '', assignedTo: 'unassigned'
    });
  };

  useEffect(() => {
    if (!open) { resetState(); return; }
    if (!incidentId) return;
    const fetchIncident = async () => {
      const { data } = await supabase.from('incidents').select('*').eq('id', incidentId).single();
      if (data) {
        setSelected(data);
        
        // Get creator email if available
        if (data.created_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', data.created_by)
            .single();
          
          if (profile) {
            const { data: userAuth } = await supabase.auth.getUser();
            if (userAuth.user?.id === data.created_by) {
              setCreatedByEmail(userAuth.user.email || 'Desconocido');
            } else {
              // For other users, we can't get email due to privacy, so show profile info
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', data.created_by)
                .single();
              setCreatedByEmail(profileData?.full_name || 'Usuario registrado');
            }
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
          name: data.name || '',
          description: data.description || '',
          occurredAt: data.occurred_at ? new Date(data.occurred_at).toISOString() : new Date().toISOString(),
          status: data.status || 'pending',
          category: data.category || 'incident',
          epic: data.epic || '',
          additionalComments: data.additional_comments || '',
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
      const payload: any = {
        name: detailForm.name,
        description: detailForm.description,
        environment: detailForm.env,
        device: detailForm.dev,
        occurred_at: new Date(detailForm.occurredAt).toISOString(),
        status: detailForm.status,
        category: detailForm.category,
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
      await supabase.from('incidents').update(payload).eq('id', selected.id);
      
      // Sync auto-linked tasks if status changed
      if (payload.status !== selected.status) {
        const taskStatus = payload.status === 'closed' ? 'resolved' : 
                          payload.status === 'in_qa' ? 'in_progress' : 
                          payload.status;
        await supabase
          .from('tasks')
          .update({ status: taskStatus })
          .eq('incident_id', selected.id)
          .eq('is_auto_linked', true);
      }
      
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
    
    if (!confirm(`¿Estás seguro de que quieres eliminar la tarea T${String(selected.incident_number ?? 0).padStart(5, '0')}?`)) {
      return;
    }
    
    try {
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
    
    const info = `ID: T${String(selected.incident_number ?? 0).padStart(5, '0')}
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selected ? `Detalle T${String(selected.incident_number ?? 0).padStart(5, '0')}` : 'Detalle de incidencia'}
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Nombre</Label>
                <Input value={detailForm.name} onChange={(e) => setDetailForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={detailForm.status} onValueChange={(v) => setDetailForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
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
                <Input type="datetime-local" value={new Date(new Date(detailForm.occurredAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)} onChange={(e) => setDetailForm((f) => ({ ...f, occurredAt: new Date(e.target.value).toISOString() }))} />
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
              <div>
                <Label>Asignar a</Label>
                <Select value={detailForm.assignedTo} onValueChange={(v) => setDetailForm((f) => ({ ...f, assignedTo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded" style={{ backgroundColor: member.color }} />
                          {member.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
