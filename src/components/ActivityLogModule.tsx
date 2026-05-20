import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getActivityLogLastSeen, setActivityLogLastSeen } from '@/lib/activityLogReadState';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActivityLogModuleProps {
  projectId: string;
}

type ActivityLogRow = {
  id: string;
  created_at: string;
  actor_name: string;
  actor_color: string;
  incident_name: string;
  incident_number: number;
  incident_category: string;
  from_status: string;
  to_status: string;
};

const STATUS_LABELS: Record<string, string> = {
  created: 'Creada',
  pending: 'Pendiente',
  in_progress: 'WIP',
  in_qa: 'En QA',
  resolved: 'En PRO',
  closed: 'Cerrada',
};

const STATUS_BADGE_CLS: Record<string, string> = {
  created: 'bg-primary text-primary-foreground border-transparent',
  pending: 'bg-muted text-muted-foreground border-transparent',
  in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent',
  in_qa: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))] border-transparent',
  resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent',
  closed: 'bg-destructive text-destructive-foreground border-transparent',
};

const CATEGORY_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  incident: { label: 'Incidencia', className: 'bg-destructive text-destructive-foreground', icon: <span>I</span> },
  improvement: { label: 'Evolutivo', className: 'bg-primary text-primary-foreground', icon: <span>E</span> },
  corrective_improvement: { label: 'Mejora correctiva', className: 'bg-purple-600 text-white', icon: <span>C</span> },
};

export default function ActivityLogModule({ projectId }: ActivityLogModuleProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [unreadSince, setUnreadSince] = useState<string | null>(null);
  const pageSize = 20;

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
      setLogs((data || []) as ActivityLogRow[]);
      setActivityLogLastSeen(projectId, user?.id, data?.[0]?.created_at || new Date().toISOString());
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cargar el registro',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, location.pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [projectId, location.pathname]);

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

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return logs.slice(start, start + pageSize);
  }, [currentPage, logs, totalPages]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityLogRow[]>();
    paginatedLogs.forEach(log => {
      const day = format(parseISO(log.created_at), 'yyyy-MM-dd');
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(log);
    });
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
  }, [paginatedLogs]);

  const formatEntry = (log: ActivityLogRow) => {
    const category = CATEGORY_META[log.incident_category] || CATEGORY_META.incident;
    if (log.from_status === 'created') {
      return `${log.actor_name} creó ${category.label} - ${log.incident_number} - ${log.incident_name} con estado ${STATUS_LABELS[log.to_status] || log.to_status}.`;
    }
    return `${log.actor_name} cambió el estado de ${category.label} - ${log.incident_number} - ${log.incident_name} de ${STATUS_LABELS[log.from_status] || log.from_status} a ${STATUS_LABELS[log.to_status] || log.to_status}.`;
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Cargando registro...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay cambios registrados todavía.
          </CardContent>
        </Card>
      ) : (
        <>
          {groups.map(group => (
            <Card key={group.day}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {formatDayTitle(group.day)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{group.items.length} cambios</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyDay(group.day, group.items)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar día
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.items.map(log => {
                  const category = CATEGORY_META[log.incident_category] || CATEGORY_META.incident;
                  const entityLabel = `${category.label} - ${log.incident_number} - ${log.incident_name}`;
                  const isUnread = isUnreadLog(log);
                  const isCreation = log.from_status === 'created';
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
                          <div className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span>{log.actor_name} {isCreation ? 'creó' : 'cambió el estado de'}</span>
                            <strong>{entityLabel}</strong>
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
          ))}
          {logs.length > pageSize && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage <= 1}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
