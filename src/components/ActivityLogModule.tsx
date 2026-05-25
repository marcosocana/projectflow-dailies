import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getActivityLogLastSeen, setActivityLogLastSeen } from '@/lib/activityLogReadState';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import IncidentDetailDialog from '@/components/IncidentDetailDialog';

interface ActivityLogModuleProps {
  projectId: string;
}

type ActivityLogRow = {
  id: string;
  created_at: string;
  incident_id: string | null;
  actor_name: string;
  actor_color: string;
  incident_name: string;
  incident_number: number;
  incident_category: string;
  from_status: string;
  to_status: string;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
};

const STATUS_LABELS: Record<string, string> = {
  created: 'Creada',
  deleted: 'Eliminada',
  pending: 'Pendiente',
  in_progress: 'WIP',
  in_qa: 'Resuelta',
  resolved: 'Resuelta',
  blocked: 'Block',
  closed: 'Cerrada',
};

const STATUS_BADGE_CLS: Record<string, string> = {
  created: 'bg-primary text-primary-foreground border-transparent',
  deleted: 'bg-destructive text-destructive-foreground border-transparent',
  pending: 'bg-muted text-muted-foreground border-transparent',
  in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent',
  in_qa: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent',
  resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent',
  blocked: 'bg-destructive text-destructive-foreground border-transparent',
  closed: 'bg-destructive text-destructive-foreground border-transparent',
};

const CATEGORY_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  incident: { label: 'Incidencia', className: 'bg-destructive text-destructive-foreground', icon: <span>I</span> },
  improvement: { label: 'Evolutivo', className: 'bg-primary text-primary-foreground', icon: <span>E</span> },
  corrective_improvement: { label: 'Mejora correctiva', className: 'bg-purple-600 text-white', icon: <span>C</span> },
  daily: { label: 'Seguimiento diario', className: 'bg-slate-600 text-white', icon: <span>S</span> },
};

const MONTH_OPTIONS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const TEAMS_LOGS_URL = 'https://teams.microsoft.com/l/chat/19:63ce0f3b03274bf5965c1fa39434813d@thread.v2/conversations?context=%7B%22contextType%22%3A%22chat%22%7D';

const buildTeamsUrl = (message: string) => {
  const separator = TEAMS_LOGS_URL.includes('?') ? '&' : '?';
  return `${TEAMS_LOGS_URL}${separator}message=${encodeURIComponent(message)}`;
};

export default function ActivityLogModule({ projectId }: ActivityLogModuleProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadSince, setUnreadSince] = useState<string | null>(null);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(String(today.getDate()));
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [queryDate, setQueryDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [detailIncidentId, setDetailIncidentId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const previousLastSeen = getActivityLogLastSeen(projectId, user?.id);
    setUnreadSince(previousLastSeen);

    try {
      const { data, error } = await supabase
        .from('incident_activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const allLogs = (data || []) as ActivityLogRow[];
      const dayKey = format(queryDate, 'yyyy-MM-dd');
      const filtered = allLogs.filter(log => format(parseISO(log.created_at), 'yyyy-MM-dd') === dayKey);
      setLogs(filtered);
      if (allLogs.length > 0) {
        setActivityLogLastSeen(projectId, user?.id, allLogs[0].created_at);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cargar el registro',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id, queryDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, location.pathname]);

  useEffect(() => {
    const channel = supabase
      .channel(`incident-activity-logs-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incident_activity_logs',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadLogs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, loadLogs]);

  const formatEntry = (log: ActivityLogRow) => {
    if (log.event_type === 'daily_task_created' || log.event_type === 'daily_tasks_persisted') {
      return log.message || '';
    }
    if (log.event_type === 'incident_deleted') {
      const category = CATEGORY_META[log.incident_category] || CATEGORY_META.incident;
      return log.message || `${log.actor_name} eliminó ${category.label} - ${log.incident_number} - ${log.incident_name}.`;
    }
    const category = CATEGORY_META[log.incident_category] || CATEGORY_META.incident;
    if (log.from_status === 'created') {
      return `${log.actor_name} creó ${category.label} - ${log.incident_number} - ${log.incident_name} con estado ${STATUS_LABELS[log.to_status] || log.to_status}.`;
    }
    return `${log.actor_name} cambió el estado de ${category.label} - ${log.incident_number} - ${log.incident_name} de ${STATUS_LABELS[log.from_status] || log.from_status} a ${STATUS_LABELS[log.to_status] || log.to_status}.`;
  };

  const formatAnonymousEntry = (log: ActivityLogRow) => {
    if (log.event_type === 'daily_task_created') {
      return log.message?.replace(/^.+? creó/, 'Se creó') || '';
    }
    if (log.event_type === 'daily_tasks_persisted') {
      return log.message || '';
    }
    if (log.event_type === 'incident_deleted') {
      const category = CATEGORY_META[log.incident_category] || CATEGORY_META.incident;
      return `Se ha eliminado ${category.label} - ${log.incident_number} - ${log.incident_name}.`;
    }
    const category = CATEGORY_META[log.incident_category] || CATEGORY_META.incident;
    if (log.from_status === 'created') {
      return `Se ha creado ${category.label} - ${log.incident_number} - ${log.incident_name} con estado ${STATUS_LABELS[log.to_status] || log.to_status}.`;
    }
    return `Se ha cambiado el estado de ${category.label} - ${log.incident_number} - ${log.incident_name} de ${STATUS_LABELS[log.from_status] || log.from_status} a ${STATUS_LABELS[log.to_status] || log.to_status}.`;
  };

  const copyText = async (text: string, description: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description });
  };

  const formatDayTitle = (day: string) => {
    return format(parseISO(day), "EEEE, d 'de' MMMM yyyy", { locale: es });
  };

  const copyDay = (day: string, items: ActivityLogRow[]) => {
    const header = `${formatDayTitle(day)}\n${items.length} cambios`;
    const text = [header, ...items.map(formatEntry)].join('\n');
    copyText(text, 'Se copió el contenido del día.');
  };

  const sendToTeams = async (text: string) => {
    await navigator.clipboard.writeText(text);
    window.open(buildTeamsUrl(text), '_blank', 'noopener,noreferrer');
    toast({
      title: 'Mensaje preparado para Teams',
      description: 'Se abrió Teams con el mensaje anónimo pre-rellenado.',
    });
  };

  const sendDayToTeams = (day: string, items: ActivityLogRow[]) => {
    const header = `${formatDayTitle(day)}\n${items.length} cambios`;
    const text = [header, ...items.map(formatAnonymousEntry)].join('\n');
    sendToTeams(text);
  };

  const openIncidentDetails = (incidentId: string) => {
    setDetailIncidentId(incidentId);
    setDetailOpen(true);
  };

  const deleteLog = async (log: ActivityLogRow) => {
    try {
      const { error } = await supabase
        .from('incident_activity_logs')
        .delete()
        .eq('project_id', projectId)
        .eq('id', log.id);

      if (error) throw error;

      setLogs(currentLogs => currentLogs.filter(currentLog => currentLog.id !== log.id));
      toast({
        title: 'Log eliminado',
        description: 'Se eliminó el registro correctamente.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el registro',
        variant: 'destructive',
      });
    }
  };

  const isUnreadLog = (log: ActivityLogRow) => {
    return !unreadSince || new Date(log.created_at).getTime() > new Date(unreadSince).getTime();
  };

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result: number[] = [];
    for (let year = currentYear - 5; year <= currentYear + 1; year += 1) {
      result.push(year);
    }
    return result;
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Cargando registro...</CardContent>
      </Card>
    );
  }

  const applyDateFilter = () => {
    const day = Number(selectedDay);
    const month = Number(selectedMonth);
    const year = Number(selectedYear);
    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      toast({
        title: 'Fecha inválida',
        description: 'Selecciona una fecha válida.',
        variant: 'destructive',
      });
      return;
    }
    setQueryDate(date);
  };

  const selectedDayKey = format(queryDate, 'yyyy-MM-dd');
  const dayTitle = formatDayTitle(selectedDayKey);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtrar por fecha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger className="w-[90px]">
                <SelectValue placeholder="Día" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((monthName, index) => {
                  const month = index + 1;
                  return (
                  <SelectItem key={month} value={String(month)}>
                    {monthName}
                  </SelectItem>
                )})}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={applyDateFilter}>Ir</Button>
          </div>
        </CardContent>
      </Card>
      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay cambios registrados para {format(queryDate, 'dd/MM/yyyy')}.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card key={selectedDayKey}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{dayTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">{logs.length} cambios</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyDay(selectedDayKey, logs)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar día
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => sendDayToTeams(selectedDayKey, logs)} aria-label="Enviar día a Teams" title="Enviar día a Teams">
                    <span className="text-xs font-bold">T</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.map(log => {
                  const category = CATEGORY_META[log.incident_category] || CATEGORY_META.incident;
                  const entityLabel = `${category.label} - ${log.incident_number} - ${log.incident_name}`;
                  const isUnread = isUnreadLog(log);
                  const isCreation = log.from_status === 'created';
                  const isDailyEvent = log.event_type === 'daily_task_created' || log.event_type === 'daily_tasks_persisted';
                  const isDeletedEvent = log.event_type === 'incident_deleted';
                  return (
                    <div key={log.id} className="relative flex items-start justify-between gap-3 rounded-md border p-3">
                      {isUnread && (
                        <span
                          className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive"
                          aria-label="Cambio nuevo"
                        />
                      )}
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: log.actor_color }}>
                          {log.actor_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className={`mt-0.5 grid h-8 w-8 min-w-8 place-items-center rounded-md text-[11px] font-bold leading-none ${category.className}`}>
                          {category.icon}
                        </div>
                        <div className="min-w-0">
                          {isDailyEvent || isDeletedEvent ? (
                            <div className="text-sm">{log.message}</div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                              <span>{log.actor_name} {isCreation ? 'creó' : 'cambió el estado de'}</span>
                              {log.incident_id ? (
                                <Button
                                  variant="link"
                                  className="h-auto p-0 align-baseline text-sm font-bold"
                                  onClick={() => openIncidentDetails(log.incident_id!)}
                                >
                                  {entityLabel}
                                </Button>
                              ) : (
                                <span className="font-bold">{entityLabel}</span>
                              )}
                              {!isCreation && (
                                <>
                                  <span>de</span>
                                  <Badge variant="outline" className={STATUS_BADGE_CLS[log.from_status] || 'border-transparent'}>
                                    {STATUS_LABELS[log.from_status] || log.from_status}
                                  </Badge>
                                  <span>a</span>
                                </>
                              )}
                              {isCreation && <span>con estado</span>}
                              <Badge variant="outline" className={STATUS_BADGE_CLS[log.to_status] || 'border-transparent'}>
                                {STATUS_LABELS[log.to_status] || log.to_status}
                              </Badge>
                              <span>.</span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.actor_name} • {format(parseISO(log.created_at), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyText(formatEntry(log), 'Se copió el cambio.')}
                          aria-label="Copiar cambio"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => sendToTeams(formatAnonymousEntry(log))}
                          aria-label="Enviar cambio a Teams"
                          title="Enviar a Teams"
                        >
                          <span className="text-xs font-bold">T</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLog(log)}
                          aria-label="Eliminar log"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
              })}
            </CardContent>
          </Card>
        </>
      )}
      <IncidentDetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailIncidentId(null);
        }}
        incidentId={detailIncidentId}
      />
    </div>
  );
}
