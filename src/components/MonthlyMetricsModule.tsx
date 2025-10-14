import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MonthlyMetricsModuleProps {
  projectId: string;
}

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function MonthlyMetricsModule({ projectId }: MonthlyMetricsModuleProps) {
  const { toast } = useToast();
  const [people, setPeople] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const loadPeople = async () => {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('project_id', projectId)
      .order('name', { ascending: true });

    if (!error) {
      setPeople(data || []);
    }
  };

  const loadMetrics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('monthly_metrics')
      .select('*')
      .eq('project_id', projectId)
      .eq('year', selectedYear);

    if (!error && data) {
      const metricsMap: Record<string, number> = {};
      data.forEach(metric => {
        const key = `${metric.person_id}-${metric.month}`;
        metricsMap[key] = typeof metric.value === 'string' ? parseFloat(metric.value) : metric.value;
      });
      setMetrics(metricsMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPeople();
  }, [projectId]);

  useEffect(() => {
    if (people.length > 0) {
      loadMetrics();
    }
  }, [selectedYear, people]);

  const updateMetric = async (personId: string, month: number, value: string) => {
    const numericValue = parseFloat(value) || 0;
    const key = `${personId}-${month}`;

    // Update local state immediately
    setMetrics(prev => ({ ...prev, [key]: numericValue }));

    // Update or insert in database
    const { error } = await supabase
      .from('monthly_metrics')
      .upsert({
        project_id: projectId,
        person_id: personId,
        year: selectedYear,
        month: month,
        value: numericValue
      }, {
        onConflict: 'project_id,person_id,year,month'
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el valor',
        variant: 'destructive'
      });
      // Revert local state
      loadMetrics();
    }
  };

  const getMetricValue = (personId: string, month: number): number => {
    const key = `${personId}-${month}`;
    return metrics[key] || 0;
  };

  const availableYears = [];
  for (let i = 2020; i <= new Date().getFullYear() + 5; i++) {
    availableYears.push(i);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Imputaciones</CardTitle>
            <div className="w-[200px]">
              <Label htmlFor="year-select">Año</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger id="year-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No hay miembros en el equipo. Ve a la pestaña "Gestión del Equipo" para añadir miembros.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">
                      Miembro
                    </TableHead>
                    {MONTHS.map((month, idx) => (
                      <TableHead key={idx} className="text-center min-w-[100px]">
                        {month}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: person.color }}
                          />
                          {person.name}
                        </div>
                      </TableCell>
                      {MONTHS.map((_, monthIdx) => {
                        const month = monthIdx + 1;
                        return (
                          <TableCell key={month} className="p-2">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={getMetricValue(person.id, month)}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || parseFloat(value) >= 0) {
                                  updateMetric(person.id, month, value);
                                }
                              }}
                              className={cn(
                                "w-full text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                getMetricValue(person.id, month) === 0 
                                  ? "bg-red-50 dark:bg-red-950/20" 
                                  : "bg-green-50 dark:bg-green-950/20"
                              )}
                              disabled={loading}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
