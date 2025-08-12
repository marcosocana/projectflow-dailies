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
  const [nextVacation, setNextVacation] = useState<{person: string, date: string} | null>(null);

  useEffect(() => {
    document.title = 'Home - KPIs de proyecto';
  }, []);

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

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Resumen del proyecto</h1>
      
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
    </main>
  );
}
