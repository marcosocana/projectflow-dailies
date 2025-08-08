import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileUp, Pencil, Plus, Trash2, Eye, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

interface IncidentsModuleProps {
  projectId: string;
}

type IncidentStatus = Database['public']['Enums']['incident_status'];
type IncidentCategory = Database['public']['Enums']['incident_category'];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'in_qa', label: 'En pruebas (QA)' },
  { value: 'resolved', label: 'Resuelto (PRO)' },
  { value: 'closed', label: 'Cerrado' },
];

const CATEGORY_OPTIONS = [
  { value: 'incident', label: 'Incidencia' },
  { value: 'improvement', label: 'Mejora' },
];

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

export default function IncidentsModule({ projectId }: IncidentsModuleProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { getUrl } = useSignedUrl('project-files');

  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    evidenceLink: '',
    environment: '',
    device: '',
    occurredAt: new Date().toISOString(),
    status: 'pending',
    category: 'incident',
    additionalComments: '',
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const filtered = useMemo(() => {
    return incidents.filter((i) =>
      (statusFilter ? i.status === statusFilter : true) &&
      (categoryFilter ? i.category === categoryFilter : true)
    );
  }, [incidents, statusFilter, categoryFilter]);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('incidents').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      if (statusFilter) query = query.eq('status', statusFilter);
      if (categoryFilter) query = query.eq('category', categoryFilter);
      const { data, error } = await query;
      if (error) throw error;
      setIncidents(data || []);
    } catch (e: any) {
      toast({ title: 'Error', description: 'No se pudieron cargar las incidencias', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, [projectId, statusFilter, categoryFilter]);

  const resetForm = () => {
    setForm({
      name: '', description: '', evidenceLink: '', environment: '', device: '',
      occurredAt: new Date().toISOString(), status: 'pending', category: 'incident', additionalComments: '',
    });
    setEvidenceFile(null);
    setEditingId(null);
  };

  const handleUploadEvidence = async (incidentId: string) => {
    if (!evidenceFile) return null;
    const ext = evidenceFile.name.split('.').pop();
    const filePath = `incidents/${incidentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('project-files').upload(filePath, evidenceFile);
    if (error) throw error;
    return filePath;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let id = editingId ?? crypto.randomUUID();

      // If creating, insert with provided id to bind evidence path
      if (!editingId) {
        const insertPayload: any = {
          id,
          name: form.name,
          description: form.description,
          environment: form.environment,
          device: form.device,
          occurred_at: new Date(form.occurredAt).toISOString(),
          status: form.status,
          category: form.category,
          additional_comments: form.additionalComments,
          project_id: projectId,
          created_by: user?.id ?? null,
          evidence: form.evidenceLink || null,
        };
        if (evidenceFile) {
          const path = await handleUploadEvidence(id);
          insertPayload.evidence = path;
        }
        const { error } = await supabase.from('incidents').insert(insertPayload);
        if (error) throw error;
        toast({ title: 'Incidencia creada', description: 'Se ha creado correctamente' });
      } else {
        // Update
        const updatePayload: any = {
          name: form.name,
          description: form.description,
          environment: form.environment,
          device: form.device,
          occurred_at: new Date(form.occurredAt).toISOString(),
          status: form.status,
          category: form.category,
          additional_comments: form.additionalComments,
          evidence: form.evidenceLink || undefined,
        };
        if (evidenceFile) {
          const path = await handleUploadEvidence(id);
          updatePayload.evidence = path;
        }
        const { error } = await supabase.from('incidents').update(updatePayload).eq('id', id);
        if (error) throw error;
        toast({ title: 'Incidencia actualizada', description: 'Cambios guardados' });
      }

      resetForm();
      fetchIncidents();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo guardar la incidencia', variant: 'destructive' });
    }
  };

  const onEdit = (incident: any) => {
    setEditingId(incident.id);
    setForm({
      name: incident.name || '',
      description: incident.description || '',
      evidenceLink: incident.evidence && !incident.evidence.startsWith('incidents/') ? incident.evidence : '',
      environment: incident.environment || '',
      device: incident.device || '',
      occurredAt: incident.occurred_at ? new Date(incident.occurred_at).toISOString() : new Date().toISOString(),
      status: incident.status || 'pending',
      category: incident.category || 'incident',
      additionalComments: incident.additional_comments || '',
    });
    setEvidenceFile(null);
  };

  const onDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('incidents').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Incidencia eliminada', description: 'Se ha eliminado correctamente' });
      fetchIncidents();
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const headers = [[
      'Name','Description','Environment','Device','OccurredAt(ISO)','Status','Category','Evidence(Url)','AdditionalComments'
    ]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'incidents_template.xlsx');
  };

  const exportCurrent = async () => {
    const rows = (incidents || []).map((i) => ({
      Name: i.name,
      Description: i.description,
      Environment: i.environment,
      Device: i.device,
      OccurredAt: i.occurred_at,
      Status: i.status,
      Category: i.category,
      Evidence: i.evidence,
      AdditionalComments: i.additional_comments,
      Id: i.id,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Incidents');
    XLSX.writeFile(wb, 'incidents_export.xlsx');
  };

  const importFromExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const payload = rows.map((r) => ({
        id: crypto.randomUUID(),
        name: r.Name ?? r.Nombre ?? '',
        description: r.Description ?? r.Descripción ?? '',
        environment: r.Environment ?? r.Entorno ?? '',
        device: r.Device ?? r.Dispositivo ?? '',
        occurred_at: r.OccurredAt ?? r.Fecha ?? new Date().toISOString(),
        status: r.Status ?? 'pending',
        category: r.Category ?? 'incident',
        additional_comments: r.AdditionalComments ?? r['Comentarios adicionales'] ?? '',
        evidence: r.Evidence ?? null,
        project_id: projectId,
        created_by: user?.id ?? null,
      }));
      const { error } = await supabase.from('incidents').insert(payload);
      if (error) throw error;
      toast({ title: 'Importación completada', description: `${payload.length} incidencias creadas` });
      fetchIncidents();
    } catch (e) {
      console.error(e);
      toast({ title: 'Error al importar', description: 'Revisa el formato del Excel', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Incidencias</CardTitle>
          <CardDescription>Listado y creación de incidencias del proyecto</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Entorno</Label>
              <Input value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              <Input value={form.device} onChange={(e) => setForm((f) => ({ ...f, device: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha (ISO)</Label>
              <Input type="datetime-local" value={new Date(form.occurredAt).toISOString().slice(0,16)} onChange={(e) => setForm((f) => ({ ...f, occurredAt: new Date(e.target.value).toISOString() }))} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Evidencia (archivo)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-2">
              <Label>Evidencia (link)</Label>
              <Input placeholder="https://..." value={form.evidenceLink} onChange={(e) => setForm((f) => ({ ...f, evidenceLink: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Comentarios adicionales</Label>
              <Textarea value={form.additionalComments} onChange={(e) => setForm((f) => ({ ...f, additionalComments: e.target.value }))} />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" className="flex items-center gap-2"><Plus className="h-4 w-4" /> {editingId ? 'Guardar cambios' : 'Crear incidencia'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancelar edición</Button>}
              <Button type="button" variant="outline" className="ml-auto flex items-center gap-2" onClick={downloadTemplate}><Download className="h-4 w-4" /> Plantilla</Button>
              <Button type="button" variant="outline" className="flex items-center gap-2" onClick={exportCurrent}><Download className="h-4 w-4" /> Exportar</Button>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <FileUp className="h-4 w-4" />
                <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFromExcel(f); }} />
                <span>Importar</span>
              </label>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>Incidencias del proyecto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex-1">
              <Label>Estado</Label>
              <Select value={statusFilter ?? 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? null : (v as IncidentStatus))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Categoría</Label>
              <Select value={categoryFilter ?? 'all'} onValueChange={(v) => setCategoryFilter(v === 'all' ? null : (v as IncidentCategory))}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Evidencia</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><Badge>{STATUS_OPTIONS.find((s) => s.value === i.status)?.label ?? i.status}</Badge></TableCell>
                  <TableCell>{CATEGORY_OPTIONS.find((c) => c.value === i.category)?.label ?? i.category}</TableCell>
                  <TableCell>{new Date(i.occurred_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {i.evidence ? (
                      i.evidence.startsWith('incidents/') ? (
                        <a className="text-primary underline" target="_blank" rel="noreferrer" href="#" onClick={async (e) => { e.preventDefault(); const url = await getUrl(i.evidence); if (url) window.open(url, '_blank'); }}>
                          Ver archivo
                        </a>
                      ) : (
                        <a className="text-primary underline" target="_blank" rel="noreferrer" href={i.evidence}>Ver enlace</a>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(i)} className="flex items-center gap-1"><Pencil className="h-4 w-4" /> Editar</Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(i.id)} className="flex items-center gap-1 text-destructive"><Trash2 className="h-4 w-4" /> Borrar</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No hay incidencias</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
