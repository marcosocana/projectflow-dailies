import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Calendar, CheckCircle2, Clock, List, Columns3, FileText } from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
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

type IncidentStatus = 'pending' | 'in_progress' | 'resolved' | 'closed' | 'in_qa';
type ViewMode = 'list' | 'pipeline';

interface Incident {
  id: string;
  incident_number: number;
  name: string;
  description: string | null;
  status: IncidentStatus;
  category: 'incident' | 'improvement';
  occurred_at: string;
  created_at: string;
  environment: string | null;
  device: string | null;
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

interface SortableCardProps {
  incident: Incident;
}

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

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'in_qa': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    return category === 'incident' ? 
      <AlertTriangle className="h-4 w-4 text-red-500" /> : 
      <CheckCircle2 className="h-4 w-4 text-blue-500" />;
  };

  const getStatusLabel = (status: IncidentStatus) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_progress': return 'En curso';
      case 'resolved': return 'Resuelto';
      case 'closed': return 'Cerrado';
      case 'in_qa': return 'En QA';
      default: return status;
    }
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
          {getCategoryIcon(incident.category)}
          <span className="font-medium text-sm">#{incident.incident_number}</span>
        </div>
        <Badge className={`text-xs ${getStatusColor(incident.status)}`}>
          {getStatusLabel(incident.status)}
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
      toast.error('Error al cargar las incidencias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
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

    // Update locally first for immediate feedback
    setIncidents(prev => 
      prev.map(inc => 
        inc.id === activeId ? { ...inc, status: newStatus } : inc
      )
    );

    // Update in database
    try {
      const { error } = await supabase
        .from('incidents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', activeId);

      if (error) throw error;
      
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

  const getStatusLabel = (status: IncidentStatus) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_progress': return 'En curso';
      case 'resolved': return 'Resuelto';
      case 'closed': return 'Cerrado';
      case 'in_qa': return 'En QA';
      default: return status;
    }
  };

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'in_qa': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    return category === 'incident' ? 
      <AlertTriangle className="h-4 w-4 text-red-500" /> : 
      <CheckCircle2 className="h-4 w-4 text-blue-500" />;
  };

  const incidentsByStatus = useMemo(() => {
    return {
      pending: incidents.filter(inc => inc.status === 'pending'),
      in_progress: incidents.filter(inc => inc.status === 'in_progress'),
      resolved: incidents.filter(inc => inc.status === 'resolved'),
    };
  }, [incidents]);

  const renderListView = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Incidencias recientes
        </CardTitle>
        <CardDescription>Últimas 20 incidencias del proyecto</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando incidencias...</div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">No hay incidencias registradas</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-medium">#{incident.incident_number}</TableCell>
                  <TableCell>{incident.name}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(incident.status)}`}>
                      {getStatusLabel(incident.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {getCategoryIcon(incident.category)}
                      <span className="capitalize">{incident.category === 'incident' ? 'Incidencia' : 'Mejora'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(incident.occurred_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['pending', 'in_progress', 'resolved'] as IncidentStatus[]).map((status) => (
                <div 
                  key={status}
                  id={`column-${status}`}
                  className="bg-muted/50 rounded-lg p-4 min-h-[400px]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{getStatusLabel(status)}</h3>
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
                </div>
              ))}
            </div>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resumen del proyecto</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            Lista
          </Button>
          <Button
            variant={viewMode === 'pipeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('pipeline')}
            className="flex items-center gap-2"
          >
            <Columns3 className="h-4 w-4" />
            Pipeline
          </Button>
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
    </main>
  );
}