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
import { Download, FileUp, Pencil, Plus, Trash2, Eye, ArrowUpDown, MoreVertical, RefreshCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import type React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';

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

const ENV_OPTIONS = ['DEV','PRE','PRO','Otro'] as const;
const DEVICE_OPTIONS = ['Web','APP','Otro'] as const;

/* UI helpers */
function StatusBadge({ status }: { status: IncidentStatus }) {
  const label = STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
  const classMap: Record<IncidentStatus, string> = {
    pending: 'bg-muted text-muted-foreground', // Gris
    in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]', // Naranja
    in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]', // Azul
    resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]', // Verde
    closed: 'bg-destructive text-destructive-foreground', // Rojo
  } as const;
  return <Badge variant="outline" className={`${classMap[status]} border-transparent`}>{label}</Badge>;
}

function CategoryIcon({ category }: { category: IncidentCategory }) {
  if (category === 'incident') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-grid place-items-center h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">i</span>
        <span className="text-sm text-muted-foreground">Incidencia</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="inline-grid place-items-center h-5 w-5 rounded-sm bg-primary text-primary-foreground text-[10px] font-bold">M</span>
      <span className="text-sm text-muted-foreground">Mejora</span>
    </div>
  );
}

type ImportButtonProps = { onFile: (file: File) => void };
const ImportButton = ({ onFile }: ImportButtonProps) => (
  <label className="inline-flex items-center gap-2 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md h-10 px-4 py-2 text-sm font-medium">
    <FileUp className="h-4 w-4" />
    <span>Importar</span>
    <input
      type="file"
      accept=".xlsx,.xls"
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
    />
  </label>
);

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
const [statusFilters, setStatusFilters] = useState<IncidentStatus[]>([]);
const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | null>(null);

const [search, setSearch] = useState('');
const [sortKey, setSortKey] = useState<'name' | 'status' | 'category' | 'occurred_at'>('occurred_at');
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

const toggleSort = (key: 'name' | 'status' | 'category' | 'occurred_at') => {
  setSortDir((d) => (sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
  setSortKey(key);
};

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
const [detailEvidenceFile, setDetailEvidenceFile] = useState<File | null>(null);
// Editable detail modal form
const [detailForm, setDetailForm] = useState({
  name: '',
  description: '',
  occurredAt: new Date().toISOString(),
  status: 'pending' as IncidentStatus,
  category: 'incident' as IncidentCategory,
  additionalComments: '',
  env: '' as string,
  dev: '' as string,
  evidenceLink: '',
});
const isInitialDetailLoad = useRef(true);

const [createOpen, setCreateOpen] = useState(false);
const [detailsOpen, setDetailsOpen] = useState(false);
const [selected, setSelected] = useState<any | null>(null);
const [comments, setComments] = useState<any[]>([]);
const [commentText, setCommentText] = useState('');
const importInputRef = useRef<HTMLInputElement>(null);

const filtered = useMemo(() => {
  const term = search.trim().toLowerCase();
  return incidents.filter((i) =>
    (statusFilters.length ? statusFilters.includes(i.status) : true) &&
    (categoryFilter ? i.category === categoryFilter : true) &&
    (term
      ? [i.id, `T${String(i.incident_number ?? 0).padStart(5, '0')}`, i.name, i.description, i.environment, i.device, i.status, i.category, i.additional_comments]
          .filter(Boolean)
          .some((v: any) => String(v).toLowerCase().includes(term))
      : true)
  );
}, [incidents, statusFilters, categoryFilter, search]);

const sorted = useMemo(() => {
  const arr = [...filtered];
  arr.sort((a, b) => {
    const key = sortKey;
    let av = a[key];
    let bv = b[key];
    if (key === 'occurred_at') {
      av = new Date(a.occurred_at).getTime();
      bv = new Date(b.occurred_at).getTime();
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return arr;
}, [filtered, sortKey, sortDir]);

const fetchIncidents = async () => {
  setLoading(true);
  try {
    let query = supabase
      .from('incidents')
      .select('*')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: true });
    if (statusFilters.length) query = query.in('status', statusFilters as any);
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

  useEffect(() => { fetchIncidents(); }, [projectId, statusFilters, categoryFilter]);

  const resetForm = () => {
    setForm({
      name: '', description: '', evidenceLink: '', environment: '', device: '',
      occurredAt: new Date().toISOString(), status: 'pending', category: 'incident', additionalComments: '',
    });
    setEvidenceFile(null);
    setEditingId(null);
  };

  const handleUploadEvidence = async (incidentId: string, file?: File) => {
    const fileToUpload = file || evidenceFile || detailEvidenceFile;
    if (!fileToUpload) return null;
    const ext = fileToUpload.name.split('.').pop();
    const filePath = `incidents/${incidentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('project-files').upload(filePath, fileToUpload);
    if (error) throw error;
    return filePath;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let id = editingId ?? crypto.randomUUID();

// Compose environment/device from single-selects
const environmentValue = form.environment || '';
const deviceValue = form.device || '';

      // If creating, insert with provided id to bind evidence path
      if (!editingId) {
        const insertPayload: any = {
          id,
          name: form.name,
          description: form.description,
          environment: environmentValue,
          device: deviceValue,
          occurred_at: new Date(form.occurredAt).toISOString(),
          status: form.status,
          category: form.category,
          additional_comments: form.additionalComments,
          project_id: projectId,
          created_by: user?.id ?? null,
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
          environment: environmentValue,
          device: deviceValue,
          occurred_at: new Date(form.occurredAt).toISOString(),
          status: form.status,
          category: form.category,
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
} finally {
  // Close modal after create/update
  setCreateOpen(false);
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

  // Comments
  const loadComments = async (incidentId: string) => {
    const { data } = await supabase
      .from('incident_comments')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !user || !commentText.trim()) return;
    const { error } = await supabase
      .from('incident_comments')
      .insert({ incident_id: selected.id, user_id: user.id, user_email: user.email, content: commentText.trim() });
    if (!error) {
      setCommentText('');
      loadComments(selected.id);
    } else {
      toast({ title: 'Error', description: 'No se pudo añadir el comentario', variant: 'destructive' });
    }
  };

  // Initialize detail form when an incident is selected
  useEffect(() => {
    if (!selected) return;
    isInitialDetailLoad.current = true;
const pick = (raw: string, allowed: readonly string[]) =>
  (raw || '').split(',').map((s) => s.trim()).find((v) => allowed.includes(v)) || '';
setDetailForm({
  name: selected.name || '',
  description: selected.description || '',
  occurredAt: selected.occurred_at ? new Date(selected.occurred_at).toISOString() : new Date().toISOString(),
  status: (selected.status || 'pending') as IncidentStatus,
  category: (selected.category || 'incident') as IncidentCategory,
  additionalComments: selected.additional_comments || '',
  env: pick(selected.environment || '', ENV_OPTIONS),
  dev: pick(selected.device || '', DEVICE_OPTIONS),
  evidenceLink: selected.evidence && !selected.evidence.startsWith('incidents/') ? selected.evidence : '',
});
  }, [selected]);

  // Autosave detail form (500ms debounce)
  useEffect(() => {
    if (!selected) return;
    if (isInitialDetailLoad.current) { isInitialDetailLoad.current = false; return; }
    const handler = setTimeout(async () => {
      const payload: any = {
        name: detailForm.name,
        description: detailForm.description,
        environment: detailForm.env,
        device: detailForm.dev,
        occurred_at: new Date(detailForm.occurredAt).toISOString(),
        status: detailForm.status,
        category: detailForm.category,
        evidence: selected.evidence,
      };
      
      // Handle file upload if there's a new file
      if (detailEvidenceFile) {
        try {
          const path = await handleUploadEvidence(selected.id);
          payload.evidence = path;
          setDetailEvidenceFile(null); // Clear after upload
        } catch (e) {
          console.error('Error uploading file:', e);
        }
      }
      
      await supabase.from('incidents').update(payload).eq('id', selected.id);
      setSelected((prev: any) => (prev ? { ...prev, ...payload } : prev));
      setIncidents((prev) => prev.map((i) => (i.id === selected.id ? { ...i, ...payload } : i)));
    }, 500);
    return () => clearTimeout(handler);
  }, [detailForm, selected, detailEvidenceFile]);

  return (
  <div className="space-y-6">
    <Card>
      <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Gestión de Incidencias</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Crear tarea
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchIncidents} aria-label="Actualizar" title="Actualizar">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              {/* Hidden file input for Importar */}
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importFromExcel(f); }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Más acciones">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={downloadTemplate}>Plantilla</DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportCurrent}>Exportar</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => importInputRef.current?.click()}>Importar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <Label>Buscar</Label>
            <Input placeholder="Buscar por texto o ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label>Estado</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {statusFilters.length ? `${statusFilters.length} seleccionados` : 'Todos'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuCheckboxItem
                  checked={statusFilters.length === 0}
                  onCheckedChange={() => setStatusFilters([])}
                >
                  Todos
                </DropdownMenuCheckboxItem>
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s.value}
                    checked={statusFilters.includes(s.value as IncidentStatus)}
                    onCheckedChange={(checked) => {
                      setStatusFilters((prev) => {
                        if (checked) return [...prev, s.value as IncidentStatus];
                        return prev.filter((v) => v !== (s.value as IncidentStatus));
                      });
                    }}
                  >
                    {s.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
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
              <TableHead>ID</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                Nombre <ArrowUpDown className="inline h-4 w-4 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                Estado <ArrowUpDown className="inline h-4 w-4 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('category')}>
                Categoría <ArrowUpDown className="inline h-4 w-4 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('occurred_at')}>
                Fecha <ArrowUpDown className="inline h-4 w-4 ml-1" />
              </TableHead>
              <TableHead>Evidencia</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{`T${String(i.incident_number ?? 0).padStart(5, '0')}`}</TableCell>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell>
                  <StatusBadge status={i.status} />
                </TableCell>
                <TableCell>
                  <CategoryIcon category={i.category} />
                </TableCell>
                <TableCell>{new Date(i.occurred_at).toLocaleString()}</TableCell>
                <TableCell>
                  {i.evidence && i.evidence.startsWith('incidents/') ? (
                    <a className="text-primary underline" target="_blank" rel="noreferrer" href="#" onClick={async (e) => { e.preventDefault(); const url = await getUrl(i.evidence); if (url) window.open(url, '_blank'); }}>
                      Ver archivo
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={async () => { setSelected(i); setDetailsOpen(true); await loadComments(i.id); }} aria-label="Ver más">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(i.id)} aria-label="Eliminar" className="text-foreground">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">No hay incidencias</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    {/* Crear/Editar incidencia */}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar incidencia' : 'Crear incidencia'}</DialogTitle>
          <DialogDescription>Completa la información de la incidencia o mejora</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
<Label>Entorno</Label>
<Select value={form.environment} onValueChange={(v) => setForm((f) => ({ ...f, environment: v }))}>
  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
  <SelectContent>
    {ENV_OPTIONS.map((opt) => (
      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
    ))}
  </SelectContent>
</Select>
          </div>
          <div className="space-y-2">
<Label>Dispositivo</Label>
<Select value={form.device} onValueChange={(v) => setForm((f) => ({ ...f, device: v }))}>
  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
  <SelectContent>
    {DEVICE_OPTIONS.map((opt) => (
      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
    ))}
  </SelectContent>
</Select>
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
          <div className="space-y-2 md:col-span-2">
            <Label>Comentarios adicionales</Label>
            <Textarea value={form.additionalComments} onChange={(e) => setForm((f) => ({ ...f, additionalComments: e.target.value }))} />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            {editingId && <Button type="button" variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }}>Cancelar</Button>}
            <Button type="submit" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> {editingId ? 'Guardar cambios' : 'Crear incidencia'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Ver más */}
    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de incidencia</DialogTitle>
          <DialogDescription>Ver información completa y comentarios</DialogDescription>
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
                <Select value={detailForm.status} onValueChange={(v) => setDetailForm((f) => ({ ...f, status: v as IncidentStatus }))}>
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={detailForm.category} onValueChange={(v) => setDetailForm((f) => ({ ...f, category: v as IncidentCategory }))}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="datetime-local" value={new Date(detailForm.occurredAt).toISOString().slice(0,16)} onChange={(e) => setDetailForm((f) => ({ ...f, occurredAt: new Date(e.target.value).toISOString() }))} />
              </div>
              <div>
<Label>Entorno</Label>
<Select value={detailForm.env} onValueChange={(v) => setDetailForm((f) => ({ ...f, env: v }))}>
  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
  <SelectContent>
    {ENV_OPTIONS.map((opt) => (
      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
    ))}
  </SelectContent>
</Select>
              </div>
              <div>
<Label>Dispositivo</Label>
<Select value={detailForm.dev} onValueChange={(v) => setDetailForm((f) => ({ ...f, dev: v }))}>
  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
  <SelectContent>
    {DEVICE_OPTIONS.map((opt) => (
      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
                <Input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={(e) => setDetailEvidenceFile(e.target.files?.[0] ?? null)} 
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Evidencia actual</Label>
                <div>
                  {selected.evidence && selected.evidence.startsWith('incidents/') ? (
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
                {comments.length === 0 && (
                  <div className="text-sm text-muted-foreground">Sin comentarios aún</div>
                )}
              </div>
              <form onSubmit={addComment} className="mt-3 flex gap-2">
                <Input
                  placeholder="Escribe un comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <Button type="submit" disabled={!user}>Enviar</Button>
              </form>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
