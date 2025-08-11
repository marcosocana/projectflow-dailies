import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Calendar, CheckCircle2, Clock, Home as HomeIcon, ListChecks } from 'lucide-react';

interface HomeModuleProps {
  projectId: string;
}

type IncidentStatus = 'pending' | 'in_progress' | 'resolved' | string;

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

export default function HomeModule({ projectId }: HomeModuleProps) {
  const [totalIncidents, setTotalIncidents] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [totalImprovements, setTotalImprovements] = useState<number>(0);
  const [upcomingVacations, setUpcomingVacations] = useState<UpcomingVacation[]>([]);
  const [peopleMap, setPeopleMap] = useState<Record<string, Person>>({});

  useEffect(() => {
    document.title = 'Home - KPIs de proyecto';
  }, []);

  useEffect(() => {
    const loadData = async () => {
      // Total incidencias
      const { count: totalInc, error: totalErr } = await supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      if (!totalErr && typeof totalInc === 'number') setTotalIncidents(totalInc);

      // Incidencias por estado (client grouping)
      const { data: statusRows } = await supabase
        .from('incidents')
        .select('status')
        .eq('project_id', projectId);
      const grouped: Record<string, number> = {};
      (statusRows || []).forEach(r => {
        const s = (r as any).status as IncidentStatus;
        grouped[s] = (grouped[s] || 0) + 1;
      });
      setStatusCounts(grouped);

      // Total mejoras (si existe la categoría "improvement")
      const { count: improvementsCount } = await supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('category', 'improvement');
      setTotalImprovements(improvementsCount || 0);

      // Próximas vacaciones (siguientes 7-10)
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      const { data: vacs } = await supabase
        .from('vacations')
        .select('id,start_date,end_date,person_id,description')
        .eq('project_id', projectId)
        .gte('start_date', todayStr)
        .order('start_date', { ascending: true })
        .limit(10);
      setUpcomingVacations(vacs || []);

      const personIds = Array.from(new Set((vacs || []).map(v => v.person_id).filter(Boolean))) as string[];
      if (personIds.length) {
        const { data: ppl } = await supabase
          .from('people')
          .select('id,name,role,color')
          .in('id', personIds);
        const map: Record<string, Person> = {};
        (ppl || []).forEach(p => { map[p.id] = p as Person; });
        setPeopleMap(map);
      } else {
        setPeopleMap({});
      }
    };

    loadData();
  }, [projectId]);

  const statusOrder = useMemo(() => ['in_progress', 'pending', 'resolved'], []);
  const STATUS_LABELS: Record<string, string> = { in_progress: 'En curso', pending: 'Pendiente', resolved: 'Resuelto' };
  const STATUS_BADGE_CLS: Record<string, string> = {
    in_progress: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
    pending: 'bg-muted text-muted-foreground',
    resolved: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  };

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Resumen del proyecto</h1>
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" /> Total incidencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalIncidents}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" /> Incidencias por estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.keys(statusCounts).length === 0 && (
                <span className="text-muted-foreground text-sm">Sin datos</span>
              )}
              {statusOrder.map(key => (
                <div key={key} className="w-24 text-center">
                  <div className="text-3xl font-bold">{statusCounts[key] || 0}</div>
                  <Badge variant="outline" className={`${STATUS_BADGE_CLS[key] || 'bg-accent text-accent-foreground'} border-transparent mt-1`}>
                    {STATUS_LABELS[key] || key}
                  </Badge>
                </div>
              ))}
              {Object.keys(statusCounts)
                .filter(k => !statusOrder.includes(k))
                .map(k => (
                  <div key={k} className="w-24 text-center">
                    <div className="text-3xl font-bold">{statusCounts[k] || 0}</div>
                    <Badge variant="outline" className="bg-accent text-accent-foreground border-transparent mt-1">{k}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" /> Total mejoras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalImprovements}</div>
          </CardContent>
        </Card>
      </div>

      {/* Próximas vacaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Próximas vacaciones
          </CardTitle>
          <CardDescription>Próximas salidas del equipo</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingVacations.length === 0 ? (
            <p className="text-muted-foreground">No hay vacaciones próximas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingVacations.map(v => {
                  const p = v.person_id ? peopleMap[v.person_id] : undefined;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>{v.start_date}</TableCell>
                      <TableCell>{v.end_date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: p?.color || 'transparent' }} />
                          {p?.name || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{p?.role || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
