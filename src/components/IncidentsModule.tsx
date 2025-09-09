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
import { Download, FileUp, Pencil, Plus, Trash2, Eye, ArrowUpDown, MoreVertical, RefreshCcw, AlertTriangle, ListChecks, CheckCircle2, Copy, List, Columns3, Clock } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import type React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import IncidentDetailDialog from '@/components/IncidentDetailDialog';
interface IncidentsModuleProps {
  projectId: string;
}
type ViewMode = 'list' | 'pipeline';
interface SortableIncidentCardProps {
  incident: any;
  onEdit: (incident: any) => void;
  onDelete: (id: string) => void;
  onViewDetails: (incident: any) => void;
  onCopy: (incident: any) => void;
}
type IncidentStatus = Database['public']['Enums']['incident_status'];
type IncidentCategory = Database['public']['Enums']['incident_category'];
const STATUS_OPTIONS = [{
  value: 'pending',
  label: 'Pendiente'
}, {
  value: 'in_progress',
  label: 'En curso'
}, {
  value: 'in_qa',
  label: 'En pruebas'
}, {
  value: 'resolved',
  label: 'Resuelta'
}, {
  value: 'closed',
  label: 'Cerrada'
}];
const CATEGORY_OPTIONS = [{
  value: 'incident',
  label: 'Incidencia'
}, {
  value: 'improvement',
  label: 'Mejora'
}];
const ENV_OPTIONS = ['DEV', 'PRE', 'PRO', 'Otro', 'Desconocido'] as const;
const DEVICE_OPTIONS = ['APP', 'Web', 'Otro', 'Desconocido'] as const;
// Dynamic epic options will be calculated from database

// Status constants available module-wide to avoid TDZ issues
const statusOrder = ['pending', 'in_progress', 'in_qa', 'resolved', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  in_qa: 'En pruebas',
  resolved: 'Resuelta',
  closed: 'Cerrada'
};
const STATUS_BADGE_CLS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
  in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
  resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  closed: 'bg-destructive text-destructive-foreground'
};

/* UI helpers */
function StatusBadge({
  status
}: {
  status: IncidentStatus;
}) {
  const label = STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
  const classMap: Record<IncidentStatus, string> = {
    pending: 'bg-muted text-muted-foreground',
    // Gris
    in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
    // Naranja
    in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
    // Azul
    resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
    // Verde
    closed: 'bg-destructive text-destructive-foreground' // Rojo
  } as const;
  return <Badge variant="outline" className={`${classMap[status]} border-transparent`}>{label}</Badge>;
}
function CategoryIcon({
  category
}: {
  category: IncidentCategory;
}) {
  if (category === 'incident') {
    return <span className="inline-grid place-items-center h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">i</span>;
  }
  return <span className="inline-grid place-items-center h-5 w-5 rounded-sm bg-primary text-primary-foreground text-[10px] font-bold">M</span>;
}
type ImportButtonProps = {
  onFile: (file: File) => void;
};
const ImportButton = ({
  onFile
}: ImportButtonProps) => <label className="inline-flex items-center gap-2 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md h-10 px-4 py-2 text-sm font-medium">
    <FileUp className="h-4 w-4" />
    <span>Importar</span>
    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }} />
  </label>;
function useSignedUrl(bucket: string) {
  const cache = useRef(new Map<string, string>());
  const getUrl = async (path: string | null | undefined) => {
    if (!path) return null;
    if (cache.current.has(path)) return cache.current.get(path)!;
    const {
      data,
      error
    } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) return null;
    cache.current.set(path, data.signedUrl);
    return data.signedUrl;
  };
  return {
    getUrl
  };
}
const SortableIncidentCard = ({
  incident,
  onEdit,
  onDelete,
  onViewDetails,
  onCopy
}: SortableIncidentCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: incident.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const getStatusColor = (status: IncidentStatus) => {
    return STATUS_BADGE_CLS[status] || 'bg-muted text-muted-foreground';
  };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-move">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <CategoryIcon category={incident.category} />
          <span className="font-medium text-sm">#{incident.incident_number}</span>
        </div>
        <Badge variant="outline" className={`text-xs ${getStatusColor(incident.status)} border-transparent`}>
          {STATUS_LABELS[incident.status]}
        </Badge>
      </div>
      <h4 className="font-semibold text-sm mb-2 line-clamp-2">{incident.name}</h4>
      {incident.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {incident.description}
        </p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(incident.occurred_at).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onCopy(incident)}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onViewDetails(incident)}>
            
          </Button>
        </div>
      </div>
    </div>;
};
export default function IncidentsModule({
  projectId
}: IncidentsModuleProps) {
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const {
    getUrl
  } = useSignedUrl('project-files');
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  }));
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');
  const [epicFilter, setEpicFilter] = useState<string>('all');
  const [availableEpics, setAvailableEpics] = useState<string[]>([]);

  // Confirmation modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    incidentId: string;
    incidentNumber: number;
    fromStatus: IncidentStatus;
    toStatus: IncidentStatus;
  } | null>(null);

  // KPI filtering state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'status' | 'occurred_at' | 'incident_number' | 'epic' | 'device' | 'environment'>('occurred_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (key: 'name' | 'status' | 'occurred_at' | 'incident_number' | 'epic' | 'device' | 'environment') => {
    setSortDir(d => sortKey === key ? d === 'asc' ? 'desc' : 'asc' : 'asc');
    setSortKey(key);
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    evidenceLink: '',
    environment: '',
    device: '',
    epic: '',
    occurredAt: new Date().toISOString(),
    status: 'pending',
    category: 'incident',
    additionalComments: '',
    createdBy: ''
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // KPIs state
  const [totalIncidents, setTotalIncidents] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [totalImprovements, setTotalImprovements] = useState<number>(0);
  const [improvementStatusCounts, setImprovementStatusCounts] = useState<Record<string, number>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return incidents.filter(i => (channelFilter === 'all' || i.device === channelFilter) && (environmentFilter === 'all' || i.environment === environmentFilter) && (epicFilter === 'all' || i.epic === epicFilter) && (statusFilter === 'all' || i.status === statusFilter) && (categoryFilter === 'all' || i.category === categoryFilter) && (term ? [i.id, `T${String(i.incident_number ?? 0).padStart(5, '0')}`, i.name, i.description, i.environment, i.device, i.status, i.category, i.additional_comments].filter(Boolean).some((v: any) => String(v).toLowerCase().includes(term)) : true));
  }, [incidents, channelFilter, environmentFilter, epicFilter, statusFilter, categoryFilter, search]);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const key = sortKey;
      let av: any = a[key as keyof typeof a];
      let bv: any = b[key as keyof typeof b];
      if (key === 'occurred_at') {
        av = new Date(a.occurred_at).getTime();
        bv = new Date(b.occurred_at).getTime();
      } else if (key === 'status') {
        const idx = (s: string) => {
          const i = (statusOrder as readonly string[]).indexOf(s);
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        av = idx(a.status);
        bv = idx(b.status);
      } else if (key === 'incident_number') {
        av = a.incident_number || 0;
        bv = b.incident_number || 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Paginated results
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [sorted, currentPage, pageSize]);
  const totalPages = Math.ceil(sorted.length / pageSize);
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('incidents').select('*').eq('project_id', projectId).order('occurred_at', {
        ascending: true
      });
      if (error) throw error;
      setIncidents(data || []);

      // Extract unique epics from database
      const epics = [...new Set(data?.map(i => i.epic).filter(Boolean))].sort();
      setAvailableEpics(epics);

      // Calculate KPIs (siempre con todos los datos, sin filtros de UI)
      const all = data || [];

      // Incidencias (categoría incident)
      const onlyIncidents = all.filter(i => i.category === 'incident');
      setTotalIncidents(onlyIncidents.length);
      const statusGrouped: Record<string, number> = {};
      onlyIncidents.forEach(incident => {
        const status = incident.status;
        statusGrouped[status] = (statusGrouped[status] || 0) + 1;
      });
      setStatusCounts(statusGrouped);

      // Mejoras (categoría improvement)
      const onlyImprovements = all.filter(i => i.category === 'improvement');
      setTotalImprovements(onlyImprovements.length);
      const improvementGrouped: Record<string, number> = {};
      onlyImprovements.forEach(imp => {
        const status = imp.status;
        improvementGrouped[status] = (improvementGrouped[status] || 0) + 1;
      });
      setImprovementStatusCounts(improvementGrouped);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las incidencias',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchIncidents();
    fetchTeamMembers();
  }, [projectId]);
  const fetchTeamMembers = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('people').select('*').eq('project_id', projectId).order('name', {
        ascending: true
      });
      if (error) throw error;
      setTeamMembers(data || []);
    } catch (e: any) {
      console.error('Error fetching team members:', e);
    }
  };
  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      evidenceLink: '',
      environment: 'Desconocido',
      device: 'Desconocido',
      epic: '',
      occurredAt: new Date().toISOString(),
      status: 'pending',
      category: 'incident',
      additionalComments: '',
      createdBy: ''
    });
    setEvidenceFile(null);
    setEditingId(null);
  };
  const handleUploadEvidence = async (incidentId: string, file?: File) => {
    const fileToUpload = file || evidenceFile;
    if (!fileToUpload) return null;
    const ext = fileToUpload.name.split('.').pop();
    const filePath = `incidents/${incidentId}/${crypto.randomUUID()}.${ext}`;
    const {
      error
    } = await supabase.storage.from('project-files').upload(filePath, fileToUpload);
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
          epic: form.epic,
          occurred_at: new Date(form.occurredAt).toISOString(),
          status: form.status,
          category: form.category,
          additional_comments: form.additionalComments,
          project_id: projectId,
          created_by: user?.id ?? null,
          assigned_to: form.createdBy || null
        };
        if (evidenceFile) {
          const path = await handleUploadEvidence(id);
          insertPayload.evidence = path;
        }
        const {
          error
        } = await supabase.from('incidents').insert(insertPayload);
        if (error) throw error;
        toast({
          title: 'Incidencia creada',
          description: 'Se ha creado correctamente'
        });
      } else {
        // Update
        const updatePayload: any = {
          name: form.name,
          description: form.description,
          environment: environmentValue,
          device: deviceValue,
          epic: form.epic,
          occurred_at: new Date(form.occurredAt).toISOString(),
          status: form.status,
          category: form.category,
          assigned_to: form.createdBy || null
        };
        if (evidenceFile) {
          const path = await handleUploadEvidence(id);
          updatePayload.evidence = path;
        }
        const {
          error
        } = await supabase.from('incidents').update(updatePayload).eq('id', id);
        if (error) throw error;
        toast({
          title: 'Incidencia actualizada',
          description: 'Cambios guardados'
        });
      }
      resetForm();
      fetchIncidents();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la incidencia',
        variant: 'destructive'
      });
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
      epic: incident.epic || '',
      occurredAt: incident.occurred_at ? new Date(incident.occurred_at).toISOString() : new Date().toISOString(),
      status: incident.status || 'pending',
      category: incident.category || 'incident',
      additionalComments: incident.additional_comments || '',
      createdBy: incident.assigned_to || ''
    });
    setEvidenceFile(null);
  };
  const copyToClipboard = async (incident: any) => {
    const basicInfo = `ID: T${String(incident.incident_number ?? 0).padStart(5, '0')}
Nombre: ${incident.name}
Descripción: ${incident.description || 'Sin descripción'}
Épica: ${incident.epic || 'No asignada'}
Canal: ${incident.device || 'No especificado'}
Entorno: ${incident.environment || 'No especificado'}
Fecha: ${new Date(incident.occurred_at).toLocaleDateString('es-ES')}
Estado: ${STATUS_LABELS[incident.status] || incident.status}`;
    try {
      await navigator.clipboard.writeText(basicInfo);
      toast({
        description: "Información copiada al portapapeles"
      });
    } catch (err) {
      toast({
        description: "Error al copiar la información",
        variant: "destructive"
      });
    }
  };
  const onDelete = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('incidents').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: 'Incidencia eliminada',
        description: 'Se ha eliminado correctamente'
      });
      fetchIncidents();
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar',
        variant: 'destructive'
      });
    }
  };
  const downloadTemplate = () => {
    const headers = [['Name', 'Description', 'Environment', 'Device', 'OccurredAt(ISO)', 'Status', 'Category', 'Epic', 'Evidence(Url)', 'AdditionalComments']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'incidents_template.xlsx');
  };
  const exportCurrent = async () => {
    const rows = (incidents || []).map(i => ({
      Name: i.name,
      Description: i.description,
      Environment: i.environment,
      Device: i.device,
      Epic: i.epic,
      OccurredAt: i.occurred_at,
      Status: i.status,
      Category: i.category,
      Evidence: i.evidence,
      AdditionalComments: i.additional_comments,
      Id: i.id
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Incidents');
    XLSX.writeFile(wb, 'incidents_export.xlsx');
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropping on a column, extract the status
    let newStatus: IncidentStatus;
    if (overId.startsWith('column-')) {
      newStatus = overId.replace('column-', '') as IncidentStatus;
    } else {
      // If dropping on another card, find its status
      const overIncident = incidents.find(inc => inc.id === overId);
      if (!overIncident) return;
      newStatus = overIncident.status;
    }
    const activeIncident = incidents.find(inc => inc.id === activeId);
    if (!activeIncident || activeIncident.status === newStatus) return;

    // Show confirmation modal
    setPendingMove({
      incidentId: activeId,
      incidentNumber: activeIncident.incident_number,
      fromStatus: activeIncident.status as IncidentStatus,
      toStatus: newStatus
    });
    setConfirmOpen(true);
  };
  const confirmMove = async () => {
    if (!pendingMove) return;
    const {
      incidentId,
      toStatus
    } = pendingMove;

    // Update locally first for immediate feedback
    setIncidents(prev => prev.map(inc => inc.id === incidentId ? {
      ...inc,
      status: toStatus
    } : inc));

    // Update in database
    try {
      const {
        error
      } = await supabase.from('incidents').update({
        status: toStatus,
        updated_at: new Date().toISOString()
      }).eq('id', incidentId);
      if (error) throw error;
      toast({
        title: 'Estado actualizado',
        description: 'El estado se ha actualizado correctamente'
      });
    } catch (error) {
      console.error('Error updating incident:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive'
      });
      // Revert the change
      setIncidents(prev => prev.map(inc => inc.id === incidentId ? {
        ...inc,
        status: pendingMove.fromStatus
      } : inc));
    } finally {
      setConfirmOpen(false);
      setPendingMove(null);
    }
  };
  const cancelMove = () => {
    setConfirmOpen(false);
    setPendingMove(null);
  };
  const incidentsByStatus = useMemo(() => {
    return {
      pending: filtered.filter(inc => inc.status === 'pending'),
      in_progress: filtered.filter(inc => inc.status === 'in_progress'),
      in_qa: filtered.filter(inc => inc.status === 'in_qa'),
      resolved: filtered.filter(inc => inc.status === 'resolved'),
      closed: filtered.filter(inc => inc.status === 'closed')
    };
  }, [filtered]);
  const importFromExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const payload = rows.map(r => ({
        id: crypto.randomUUID(),
        name: r.Name ?? r.Nombre ?? '',
        description: r.Description ?? r.Descripción ?? '',
        environment: r.Environment ?? r.Entorno ?? '',
        device: r.Device ?? r.Dispositivo ?? '',
        epic: r.Epic ?? r['Épica'] ?? r.Epica ?? '',
        occurred_at: r.OccurredAt ?? r.Fecha ?? new Date().toISOString(),
        status: r.Status ?? 'pending',
        category: r.Category ?? 'incident',
        additional_comments: r.AdditionalComments ?? r['Comentarios adicionales'] ?? '',
        evidence: r.Evidence ?? null,
        project_id: projectId,
        created_by: user?.id ?? null
      }));
      const {
        error
      } = await supabase.from('incidents').insert(payload);
      if (error) throw error;
      toast({
        title: 'Importación completada',
        description: `${payload.length} incidencias creadas`
      });
      fetchIncidents();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error al importar',
        description: 'Revisa el formato del Excel',
        variant: 'destructive'
      });
    }
  };

  // Comentarios y autosave gestionados por IncidentDetailDialog

  // Detalle de incidencia gestionado por componente reutilizable

  return <div className="space-y-6">
    {/* KPIs arriba del todo */}
      {/* KPIs: dos bloques en una fila: Incidencias y Mejoras */}
      <div className="grid gap-3 md:grid-cols-12">
        {/* Bloque Incidencias */}
        <Card className="md:col-span-6">
          <CardHeader className="p-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="h-3 w-3" /> Incidencias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex items-stretch gap-3 flex-wrap md:flex-nowrap">
              {/* Total como primer KPI */}
              {(() => {
              const selected = statusFilter === 'all' && categoryFilter === 'incident';
              return <div className={`w-20 text-center cursor-pointer select-none rounded-md p-1 ${selected ? 'ring-2 ring-primary bg-primary/10' : 'hover:opacity-80'}`} onClick={() => {
                if (statusFilter === 'all' && categoryFilter === 'incident') {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                } else {
                  setStatusFilter('all');
                  setCategoryFilter('incident');
                }
                setCurrentPage(1);
              }} role="button" aria-label="Filtrar incidencias: Total">
                    <div className="text-xl font-bold">{totalIncidents}</div>
                    <Badge variant="outline" className="bg-accent text-accent-foreground border-transparent mt-1 text-[10px] px-1 py-0.5">Total</Badge>
                  </div>;
            })()}

              {/* Estados estándar en orden */}
              {statusOrder.map(key => {
              const selected = statusFilter === key && categoryFilter === 'incident';
              return <div key={key} className={`w-20 text-center cursor-pointer select-none rounded-md p-1 ${selected ? 'ring-2 ring-primary bg-primary/10' : 'hover:opacity-80'}`} onClick={() => {
                if (statusFilter === key && categoryFilter === 'incident') {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                } else {
                  setStatusFilter(key);
                  setCategoryFilter('incident');
                }
                setCurrentPage(1);
              }} role="button" aria-label={`Filtrar por estado ${STATUS_LABELS[key] || key}`}>
                    <div className="text-xl font-bold">{statusCounts[key] || 0}</div>
                    <Badge variant="outline" className={`${STATUS_BADGE_CLS[key] || 'bg-accent text-accent-foreground'} border-transparent mt-1 text-[10px] px-1 py-0.5`}>
                      {STATUS_LABELS[key] || key}
                    </Badge>
                  </div>;
            })}

              {/* Cualquier estado desconocido extra */}
              {Object.keys(statusCounts).filter(k => !(statusOrder as readonly string[]).includes(k)).map(k => {
              const selected = false; // Remove status-based filtering
              return <div key={k} className={`w-20 text-center cursor-pointer select-none rounded-md p-1 ${selected ? 'ring-2 ring-primary bg-primary/10' : 'hover:opacity-80'}`} onClick={() => {
                // No filtering logic needed
                setCurrentPage(1);
              }}>
                      <div className="text-xl font-bold">{statusCounts[k] || 0}</div>
                      <Badge variant="outline" className="bg-accent text-accent-foreground border-transparent mt-1 text-[10px] px-1 py-0.5">{k}</Badge>
                    </div>;
            })}

              {/* Sin datos */}
              {Object.keys(statusCounts).length === 0 && <span className="text-muted-foreground text-sm">Sin datos</span>}
            </div>
          </CardContent>
        </Card>

        {/* Bloque Mejoras */}
        <Card className="md:col-span-6">
          <CardHeader className="p-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="h-3 w-3" /> Mejoras
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex items-stretch gap-3 flex-wrap md:flex-nowrap">
              {/* Total como primer KPI */}
              {(() => {
              const selected = statusFilter === 'all' && categoryFilter === 'improvement';
              return <div className={`w-20 text-center cursor-pointer select-none rounded-md p-1 ${selected ? 'ring-2 ring-primary bg-primary/10' : 'hover:opacity-80'}`} onClick={() => {
                if (statusFilter === 'all' && categoryFilter === 'improvement') {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                } else {
                  setStatusFilter('all');
                  setCategoryFilter('improvement');
                }
                setCurrentPage(1);
              }} role="button" aria-label="Filtrar mejoras: Total">
                    <div className="text-xl font-bold">{totalImprovements}</div>
                    <Badge variant="outline" className="bg-accent text-accent-foreground border-transparent mt-1 text-[10px] px-1 py-0.5">Total</Badge>
                  </div>;
            })()}

              {/* Estados estándar en orden */}
              {statusOrder.map(key => {
              const selected = statusFilter === key && categoryFilter === 'improvement';
              return <div key={key} className={`w-20 text-center cursor-pointer select-none rounded-md p-1 ${selected ? 'ring-2 ring-primary bg-primary/10' : 'hover:opacity-80'}`} onClick={() => {
                if (statusFilter === key && categoryFilter === 'improvement') {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                } else {
                  setStatusFilter(key);
                  setCategoryFilter('improvement');
                }
                setCurrentPage(1);
              }} role="button" aria-label={`Filtrar mejoras por estado ${STATUS_LABELS[key] || key}`}>
                    <div className="text-xl font-bold">{improvementStatusCounts[key] || 0}</div>
                    <Badge variant="outline" className={`${STATUS_BADGE_CLS[key] || 'bg-accent text-accent-foreground'} border-transparent mt-1 text-[10px] px-1 py-0.5`}>
                      {STATUS_LABELS[key] || key}
                    </Badge>
                  </div>;
            })}

              {/* Cualquier estado desconocido extra */}
              {Object.keys(improvementStatusCounts).filter(k => !(statusOrder as readonly string[]).includes(k)).map(k => {
              const selected = false; // Remove status-based filtering
              return <div key={k} className={`w-20 text-center cursor-pointer select-none rounded-md p-1 ${selected ? 'ring-2 ring-primary bg-primary/10' : 'hover:opacity-80'}`} onClick={() => {
                // No filtering logic needed
                setCurrentPage(1);
              }}>
                      <div className="text-xl font-bold">{improvementStatusCounts[k] || 0}</div>
                      <Badge variant="outline" className="bg-accent text-accent-foreground border-transparent mt-1 text-[10px] px-1 py-0.5">{k}</Badge>
                    </div>;
            })}

              {/* Sin datos */}
              {Object.keys(improvementStatusCounts).length === 0 && <span className="text-muted-foreground text-sm">Sin datos</span>}
            </div>
          </CardContent>
        </Card>
      </div>


    <Card>
      <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle>Gestión de tareas</CardTitle>
              <div className="flex items-center gap-0 bg-muted rounded-lg p-1">
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-md" title="Lista">
                  <List className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === 'pipeline' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('pipeline')} className="rounded-md" title="Pipeline">
                  <Columns3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}>
                <Plus className="h-4 w-4 mr-2" /> Crear tarea
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchIncidents} aria-label="Actualizar" title="Actualizar">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              {/* Hidden file input for Importar */}
              <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (f) importFromExcel(f);
            }} />
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <Label>Buscar</Label>
            <Input placeholder="Buscar por texto o ID" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div>
            <Label>Canal</Label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {DEVICE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Entorno</Label>
            <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ENV_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Épica</Label>
            <Select value={epicFilter} onValueChange={setEpicFilter}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableEpics.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>


        {viewMode === 'list' ? <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('incident_number')}>
                    ID <ArrowUpDown className="inline h-4 w-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    Nombre <ArrowUpDown className="inline h-4 w-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('epic')}>
                    Épica <ArrowUpDown className="inline h-4 w-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('device')}>
                    Canal <ArrowUpDown className="inline h-4 w-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('environment')}>
                    Entorno <ArrowUpDown className="inline h-4 w-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('occurred_at')}>
                    Fecha <ArrowUpDown className="inline h-4 w-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    Estado <ArrowUpDown className="inline h-4 w-4 ml-1" />
                  </TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedIncidents.map((i: any) => <TableRow key={i.id}>
                    <TableCell>
                      <CategoryIcon category={i.category} />
                    </TableCell>
                    <TableCell className="font-mono">T{String(i.incident_number ?? 0).padStart(5, '0')}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.epic || '-'}</TableCell>
                    <TableCell>{i.device || '-'}</TableCell>
                    <TableCell>{i.environment || '-'}</TableCell>
                    <TableCell>{new Date(i.occurred_at).toLocaleDateString('es-ES')}</TableCell>
                    <TableCell><StatusBadge status={i.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(i)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                      setSelected(i);
                      setDetailsOpen(true);
                    }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
                {paginatedIncidents.length === 0 && <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">No hay incidencias</TableCell>
                  </TableRow>}
              </TableBody>
            </Table>

            {/* Controles de paginación abajo */}
            <div className="flex items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar:</span>
                <Select value={pageSize.toString()} onValueChange={value => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">resultados por página</span>
              </div>

              {totalPages > 1 && <div className="flex items-center justify-center gap-2 ml-auto">
                  <Button variant="outline" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({
                  length: Math.min(5, totalPages)
                }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return <Button key={pageNum} variant={pageNum === currentPage ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(pageNum)}>
                          {pageNum}
                        </Button>;
                })}
                  </div>
                  <Button variant="outline" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                    Siguiente
                  </Button>
                </div>}
            </div>
          </> : <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex gap-6 min-w-max pb-4">
                {statusOrder.map(status => <div key={status} id={`column-${status}`} className="bg-muted/50 rounded-lg p-4 min-h-[400px] w-80 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">{STATUS_LABELS[status]}</h3>
                      <Badge variant="secondary" className="ml-2">
                        {incidentsByStatus[status as keyof typeof incidentsByStatus]?.length || 0}
                      </Badge>
                    </div>
                    <SortableContext items={incidentsByStatus[status as keyof typeof incidentsByStatus]?.map(inc => inc.id) || []} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3 min-h-[300px]" id={`column-${status}`}>
                        {(incidentsByStatus[status as keyof typeof incidentsByStatus] || []).map(incident => <SortableIncidentCard key={incident.id} incident={incident} onEdit={i => {
                      onEdit(i);
                      setCreateOpen(true);
                    }} onDelete={onDelete} onViewDetails={i => {
                      setSelected(i);
                      setDetailsOpen(true);
                    }} onCopy={copyToClipboard} />)}
                        {(!incidentsByStatus[status as keyof typeof incidentsByStatus] || incidentsByStatus[status as keyof typeof incidentsByStatus].length === 0) && <div className="text-center py-8 text-muted-foreground text-sm">
                            No hay incidencias en este estado
                          </div>}
                      </div>
                    </SortableContext>
                  </div>)}
              </div>
            </DndContext>
          </div>}
      </CardContent>
    </Card>

    {/* Crear/Editar incidencia */}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar tarea' : 'Crear tarea'}</DialogTitle>
          <DialogDescription>Completa la información de la tarea</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={e => setForm(f => ({
              ...f,
              name: e.target.value
            }))} required />
          </div>
          <div className="space-y-2">
            <Label>Entorno</Label>
            <Select value={form.environment} onValueChange={v => setForm(f => ({
              ...f,
              environment: v
            }))}>
  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
  <SelectContent>
    {ENV_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
  </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Canal</Label>
            <Select value={form.device} onValueChange={v => setForm(f => ({
              ...f,
              device: v
            }))}>
  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
  <SelectContent>
    {DEVICE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
  </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Épica</Label>
            <Select value={form.epic} onValueChange={v => setForm(f => ({
              ...f,
              epic: v
            }))}>
  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
  <SelectContent>
    {availableEpics.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
  </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha (España)</Label>
            <Input type="datetime-local" value={(() => {
              const date = new Date(form.occurredAt);
              // Convert to Spain timezone
              const spainDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000 + 2 * 3600000); // UTC+2 for Spain
              return spainDate.toISOString().slice(0, 16);
            })()} onChange={e => {
              const localDate = new Date(e.target.value);
              // Convert from Spain timezone to UTC
              const utcDate = new Date(localDate.getTime() - 2 * 3600000); // Convert from UTC+2 to UTC
              setForm(f => ({
                ...f,
                occurredAt: utcDate.toISOString()
              }));
            }} />
          </div>
           <div className="space-y-2">
             <Label>Estado</Label>
             <Select value={form.status} onValueChange={v => setForm(f => ({
              ...f,
              status: v
            }))}>
               <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
               <SelectContent>
                 {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>
                     <div className="flex items-center gap-2">
                       <Badge variant="outline" className={`${STATUS_BADGE_CLS[s.value] || 'bg-accent text-accent-foreground'} border-transparent text-[10px] px-1 py-0.5`}>
                         {s.label}
                       </Badge>
                     </div>
                   </SelectItem>)}
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-2">
             <Label>Creado por</Label>
             <Select value={form.createdBy} onValueChange={v => setForm(f => ({
              ...f,
              createdBy: v
            }))}>
               <SelectTrigger><SelectValue placeholder="Seleccionar miembro" /></SelectTrigger>
               <SelectContent>
                 {teamMembers.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-2">
             <Label>Categoría</Label>
             <Select value={form.category} onValueChange={v => setForm(f => ({
              ...f,
              category: v
            }))}>
               <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
               <SelectContent>
                 {CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
               </SelectContent>
             </Select>
           </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({
              ...f,
              description: e.target.value
            }))} />
          </div>
          <div className="space-y-2">
            <Label>Evidencia (archivo)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            {editingId && <Button type="button" variant="outline" onClick={() => {
              resetForm();
              setCreateOpen(false);
            }}>Cancelar</Button>}
             <Button type="submit" className="flex items-center gap-2">
               <Plus className="h-4 w-4" /> {editingId ? 'Guardar cambios' : 'Crear tarea'}
             </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Ver más */}
    <IncidentDetailDialog open={detailsOpen} onOpenChange={setDetailsOpen} incidentId={selected?.id ?? null} onPatched={(id, payload) => {
      setIncidents(prev => prev.map(i => i.id === id ? {
        ...i,
        ...payload
      } : i));
      setSelected((prev: any) => prev && prev.id === id ? {
        ...prev,
        ...payload
      } : prev);
    }} onDeleted={id => {
      setIncidents(prev => prev.filter(i => i.id !== id));
      setSelected(null);
      fetchIncidents();
    }} />

    {/* Confirmation Modal for Status Change */}
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar cambio de estado</DialogTitle>
          <DialogDescription>
            {pendingMove && <>
                ¿Estás seguro de que quieres cambiar la tarea nº {pendingMove.incidentNumber} del estado "{STATUS_LABELS[pendingMove.fromStatus]}" al estado "{STATUS_LABELS[pendingMove.toStatus]}"?
              </>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={cancelMove}>
            Cancelar
          </Button>
          <Button onClick={confirmMove}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </div>;
}