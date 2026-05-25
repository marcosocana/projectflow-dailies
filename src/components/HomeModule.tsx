import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectButton } from '@/components/ui/project-button';
import { supabase } from '@/integrations/supabase/client';
import { recordIncidentStatusChange } from '@/lib/incidentActivityLog';
import { AlertTriangle, Calendar, CheckCircle2, Clock, List, Columns3, FileText, Filter, Check, X, Wrench } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import IncidentDetailDialog from '@/components/IncidentDetailDialog';
import { formatIncidentReference } from '@/lib/internalTaskIds';
import {
  getIncidentStatusLabel,
  getIncidentStatusTone,
  getStatusLogLabel,
  getStatusLogValue,
  mapIncidentStatusToTaskStatus,
  normalizeEnvironment,
  type IncidentStatus,
} from '@/lib/taskStatus';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useDroppable,
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

interface HomeModuleProps {
  projectId: string;
}

type ViewMode = 'list' | 'pipeline';

interface Incident {
  id: string;
  incident_number: number;
  name: string;
  description: string | null;
  status: IncidentStatus;
  category: 'incident' | 'improvement' | 'corrective_improvement';
  additional_comments?: string | null;
  occurred_at: string;
  created_at: string;
  environment: string | null;
  status_environment: string | null;
  device: string | null;
  assigned_to: string | null;
}

interface UpcomingVacation {
  id: string;
  start_date: string;
  end_date: string;
  person_id: string | null;
  description: string | null;
}

interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
}

const getDisplayCategory = (incident: Pick<Incident, 'category' | 'additional_comments'>) => {
  if (incident.category === 'corrective_improvement' || String(incident.additional_comments ?? '').includes('[tipo:mejora_correctiva]')) {
    return 'corrective_improvement';
  }
  return incident.category;
};

const getCategoryLabel = (category: string) => {
  if (category === 'incident') return 'Incidencia';
  if (category === 'corrective_improvement') return 'Mejora correctiva';
  return 'Evolutivo';
};

interface SortableCardProps {
  incident: Incident;
}

const PipelineColumn = ({ status, children }: { status: IncidentStatus; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/50 rounded-lg p-4 min-h-[400px] transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : ''}`}
    >
      {children}
    </div>
  );
};

const SortableCard = ({ incident }: SortableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: incident.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'incident') return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (category === 'corrective_improvement') return <Wrench className="h-4 w-4 text-purple-600" />;
    return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
  };

  const getCategoryLabel = (category: string) => {
    if (category === 'incident') return 'Incidencia';
    if (category === 'corrective_improvement') return 'Mejora correctiva';
    return 'Evolutivo';
  };

  const getDisplayCategory = (incident: Pick<Incident, 'category' | 'additional_comments'>) => {
    if (incident.category === 'corrective_improvement' || String(incident.additional_comments ?? '').includes('[tipo:mejora_correctiva]')) {
      return 'corrective_improvement';
    }
    return incident.category;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-move"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {getCategoryIcon(getDisplayCategory(incident))}
          <span className="font-medium text-sm">{formatIncidentReference(incident) ?? 'Sin ID'}</span>
        </div>
        <Badge className={`text-xs ${getIncidentStatusTone(incident.status)}`}>
          {getIncidentStatusLabel(incident.status)}
        </Badge>
      </div>
      <h4 className="font-semibold text-sm mb-2 line-clamp-2">{incident.name}</h4>
      {incident.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {incident.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {new Date(incident.occurred_at).toLocaleDateString()}
      </div>
    </div>
  );
};

export default function HomeModule({ projectId }: HomeModuleProps) {
  const [nextVacation, setNextVacation] = useState<{person: string, date: string} | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  
  // Incident detail state
  const [incidentDetailOpen, setIncidentDetailOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    document.title = 'Home - KPIs de proyecto';
  }, []);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPeople = async () => {
    try {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });

      if (error) throw error;
      setPeople(data || []);
    } catch (error) {
      console.error('Error loading people:', error);
    }
  };

  useEffect(() => {
    loadIncidents();
    loadPeople();
  }, [projectId]);

  useEffect(() => {
    const loadNextVacation = async () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      const { data: vacs } = await supabase
        .from('vacations')
        .select('start_date, person_id')
        .eq('project_id', projectId)
        .gte('start_date', todayStr)
        .order('start_date', { ascending: true })
        .limit(1);

      if (vacs && vacs.length > 0 && vacs[0].person_id) {
        const { data: person } = await supabase
          .from('people')
          .select('name')
          .eq('id', vacs[0].person_id)
          .single();

        if (person) {
          setNextVacation({
            person: person.name,
            date: vacs[0].start_date
          });
        }
      }
    };

    loadNextVacation();
  }, [projectId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeIncident = incidents.find(inc => inc.id === activeId);
    if (!activeIncident) return;

    // If dropping on a column, extract the status
    let newStatus: IncidentStatus;
    let newStatusEnvironment: string | null | undefined;
    if (overId.startsWith('column-')) {
      newStatus = overId.replace('column-', '') as IncidentStatus;
      newStatusEnvironment = newStatus === 'resolved' ? normalizeEnvironment(activeIncident?.status_environment) || 'PRO' : null;
    } else {
      // If dropping on another card, find its status
      const overIncident = incidents.find(inc => inc.id === overId);
      if (!overIncident) return;
      newStatus = overIncident.status;
      newStatusEnvironment = newStatus === 'resolved' ? normalizeEnvironment(overIncident.status_environment) || normalizeEnvironment(activeIncident?.status_environment) || 'PRO' : null;
    }

    if (activeIncident.status === newStatus && activeIncident.status_environment === newStatusEnvironment) return;

    // Update locally first for immediate feedback
    setIncidents(prev => 
      prev.map(inc => 
        inc.id === activeId ? { ...inc, status: newStatus, status_environment: newStatusEnvironment ?? inc.status_environment } : inc
      )
    );

    // Update in database
    try {
      const previousStatus = activeIncident.status;
      const { error } = await supabase
        .from('incidents')
        .update({ status: newStatus, status_environment: newStatusEnvironment, updated_at: new Date().toISOString() } as any)
        .eq('id', activeId);

      if (error) throw error;
      if (previousStatus !== newStatus || normalizeEnvironment(activeIncident.status_environment) !== normalizeEnvironment(newStatusEnvironment)) {
        await recordIncidentStatusChange({
          projectId,
          incidentId: activeId,
          incidentNumber: Number(activeIncident.incident_number),
          incidentName: activeIncident.name,
          incidentCategory: activeIncident.category,
          fromStatus: previousStatus,
          toStatus: newStatus,
          fromEnvironment: activeIncident.status_environment,
          toEnvironment: newStatusEnvironment,
        });
      }
      
      // Sync auto-linked tasks with the new status (map incident status to task status)
      await supabase
        .from('tasks')
        .update({ status: mapIncidentStatusToTaskStatus(newStatus), status_environment: newStatusEnvironment } as any)
        .eq('incident_id', activeId)
        .eq('is_auto_linked', true);
      
      toast.success('Estado actualizado correctamente');
    } catch (error) {
      console.error('Error updating incident:', error);
      toast.error('Error al actualizar el estado');
      // Revert the change
      setIncidents(prev => 
        prev.map(inc => 
          inc.id === activeId ? { ...inc, status: activeIncident.status } : inc
        )
      );
    }
  };

  const getCategoryIcon = (category: string) => {
    return category === 'incident' ? 
      <AlertTriangle className="h-4 w-4 text-red-500" /> : 
      <CheckCircle2 className="h-4 w-4 text-blue-500" />;
  };

  // Filter incidents based on selected filters
  const filteredIncidents = useMemo(() => {
    let filtered = incidents;

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(inc => selectedStatuses.includes(inc.status));
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(inc => selectedCategories.includes(getDisplayCategory(inc)));
    }

    // Assignee filter
    if (selectedAssignees.length > 0) {
      filtered = filtered.filter(inc => 
        selectedAssignees.includes('unassigned') ? !inc.assigned_to : 
        inc.assigned_to && selectedAssignees.includes(inc.assigned_to)
      );
    }

    return filtered;
  }, [incidents, selectedStatuses, selectedCategories, selectedAssignees]);

  const incidentsByStatus = useMemo(() => {
    return {
      pending: filteredIncidents.filter(inc => inc.status === 'pending'),
      in_progress: filteredIncidents.filter(inc => inc.status === 'in_progress'),
      resolved: filteredIncidents.filter(inc => inc.status === 'resolved'),
      blocked: filteredIncidents.filter(inc => inc.status === 'blocked'),
    };
  }, [filteredIncidents]);

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const openIncidentDetail = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setIncidentDetailOpen(true);
  };

  const statusOptions = [
    { value: 'pending', label: 'Pendiente' },
    { value: 'in_progress', label: 'WIP' },
    { value: 'resolved', label: 'Resuelta' },
    { value: 'blocked', label: 'Block' },
  ];

  const categoryOptions = [
    { value: 'incident', label: 'Incidencia' },
    { value: 'improvement', label: 'Evolutivo' },
    { value: 'corrective_improvement', label: 'Mejora correctiva' },
  ];

  const MultiSelectFilter = ({ 
    title, 
    options, 
    selected, 
    onSelectionChange, 
    showTotal = false 
  }: {
    title: string;
    options: { value: string; label: string }[];
    selected: string[];
    onSelectionChange: (values: string[]) => void;
    showTotal?: boolean;
  }) => {
    const [open, setOpen] = useState(false);
    
    const handleToggle = (value: string) => {
      if (value === 'total') {
        onSelectionChange([]);
        return;
      }
      
      const newSelected = selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value];
      onSelectionChange(newSelected);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-dashed"
          >
            <Filter className="mr-2 h-4 w-4" />
            {title}
            {selected.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 px-1 text-xs">
                {selected.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${title.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              <CommandGroup>
                {showTotal && (
                  <CommandItem
                    onSelect={() => {
                      handleToggle('total');
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center space-x-2 w-full">
                      <div className="h-4 w-4 flex items-center justify-center">
                        {selected.length === 0 && <Check className="h-4 w-4" />}
                      </div>
                      <span>Total</span>
                    </div>
                  </CommandItem>
                )}
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleToggle(option.value)}
                  >
                    <div className="flex items-center space-x-2 w-full">
                      <div className="h-4 w-4 flex items-center justify-center">
                        {selected.includes(option.value) && <Check className="h-4 w-4" />}
                      </div>
                      <span>{option.label}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const AssigneeFilter = () => {
    const [open, setOpen] = useState(false);
    
    const assignedPeople = people.filter(person => 
      incidents.some(inc => inc.assigned_to === person.id)
    );
    
    const options = [
      { value: 'unassigned', label: 'Sin asignar' },
      ...assignedPeople.map(person => ({ value: person.id, label: person.name }))
    ];

    const handleToggle = (value: string) => {
      const newSelected = selectedAssignees.includes(value)
        ? selectedAssignees.filter(item => item !== value)
        : [...selectedAssignees, value];
      setSelectedAssignees(newSelected);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-dashed"
          >
            <Filter className="mr-2 h-4 w-4" />
            Asignado a
            {selectedAssignees.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 px-1 text-xs">
                {selectedAssignees.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar persona..." />
            <CommandList>
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleToggle(option.value)}
                  >
                    <div className="flex items-center space-x-2 w-full">
                      <div className="h-4 w-4 flex items-center justify-center">
                        {selectedAssignees.includes(option.value) && <Check className="h-4 w-4" />}
                      </div>
                      <span>{option.label}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const renderListView = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Incidencias recientes
        </CardTitle>
        <CardDescription>Últimas 20 incidencias del proyecto</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <MultiSelectFilter
            title="Estado"
            options={statusOptions}
            selected={selectedStatuses}
            onSelectionChange={setSelectedStatuses}
            showTotal={true}
          />
          <MultiSelectFilter
            title="Categoría"
            options={categoryOptions}
            selected={selectedCategories}
            onSelectionChange={setSelectedCategories}
            showTotal={true}
          />
          <AssigneeFilter />
          {(selectedStatuses.length > 0 || selectedCategories.length > 0 || selectedAssignees.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedStatuses([]);
                setSelectedCategories([]);
                setSelectedAssignees([]);
              }}
              className="h-8"
            >
              <X className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando incidencias...</div>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">
              {incidents.length === 0 ? 'No hay incidencias registradas' : 'No se encontraron incidencias con los filtros aplicados'}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncidents.map((incident) => {
                const assignedPerson = people.find(p => p.id === incident.assigned_to);
                return (
                  <TableRow key={incident.id}>
                    <TableCell className="font-medium">{formatIncidentReference(incident) ?? '—'}</TableCell>
                    <TableCell>{incident.name}</TableCell>
                    <TableCell>
                      <Badge className={`${getIncidentStatusTone(incident.status)}`}>
                        {getStatusLogLabel(getStatusLogValue(incident.status, incident.status_environment))}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getCategoryIcon(getDisplayCategory(incident))}
                        <span>{getCategoryLabel(getDisplayCategory(incident))}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignedPerson ? (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: assignedPerson.color }}
                          title={assignedPerson.name}
                        >
                          {getInitials(assignedPerson.name)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(incident.occurred_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openIncidentDetail(incident.id)}
                      >
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

const renderPipelineView = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Columns3 className="h-5 w-5" /> Pipeline de incidencias
        </CardTitle>
        <CardDescription>Arrastra las tarjetas para cambiar el estado</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando incidencias...</div>
          </div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {(['pending', 'in_progress', 'resolved', 'blocked'] as IncidentStatus[]).map((status) => (
                <PipelineColumn key={status} status={status}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{getIncidentStatusLabel(status)}</h3>
                    <Badge variant="secondary" className="ml-2">
                      {incidentsByStatus[status].length}
                    </Badge>
                  </div>
                  <SortableContext 
                    items={incidentsByStatus[status].map(inc => inc.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {incidentsByStatus[status].map((incident) => (
                        <SortableCard key={incident.id} incident={incident} />
                      ))}
                      {incidentsByStatus[status].length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No hay incidencias en este estado
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </PipelineColumn>
              ))}
            </div>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resumen del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ProjectButton
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                Lista
              </ProjectButton>
              <ProjectButton
                variant={viewMode === 'pipeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('pipeline')}
                className="flex items-center gap-2"
              >
                <Columns3 className="h-4 w-4" />
                Pipeline
              </ProjectButton>
            </div>
          </div>
          
          {/* Próxima vacación - indicador simple */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Próxima vacación
              </CardTitle>
              <CardDescription>Siguiente persona en salir de vacaciones</CardDescription>
            </CardHeader>
            <CardContent>
              {nextVacation ? (
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="font-medium">{nextVacation.person}</span>
                    <span className="text-sm text-muted-foreground">{nextVacation.date}</span>
                  </div>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <p className="text-muted-foreground">No hay vacaciones próximas</p>
              )}
            </CardContent>
          </Card>

          {/* Incidencias - Vista Lista o Pipeline */}
          {viewMode === 'list' ? renderListView() : renderPipelineView()}
        </CardContent>
      </Card>

      {/* Incident Detail Dialog */}
      <IncidentDetailDialog
        open={incidentDetailOpen}
        onOpenChange={setIncidentDetailOpen}
        incidentId={selectedIncidentId}
        onPatched={(id, payload) => {
          setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, ...payload } : inc));
        }}
        onDeleted={(id) => {
          setIncidents(prev => prev.filter(inc => inc.id !== id));
        }}
      />
    </main>
  );
}
