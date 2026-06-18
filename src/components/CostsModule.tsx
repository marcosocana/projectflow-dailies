import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CostsModuleProps {
  projectId: string;
}

interface TeamPerson {
  id: string;
  name: string;
  role: string;
  color: string;
  order_position?: number | null;
}

const MONTH_LABELS = [
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);

const getMarginTone = (margin: number | null) => {
  if (margin === null || margin < 25) return 'bg-red-100 text-red-700 border-red-200';
  if (margin <= 30) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-green-100 text-green-700 border-green-200';
};

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function CostsModule({ projectId }: CostsModuleProps) {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [people, setPeople] = useState<TeamPerson[]>([]);
  const [hoursByPerson, setHoursByPerson] = useState<Record<string, number>>({});
  const [ratesByPerson, setRatesByPerson] = useState<Record<string, { costRate: number; saleRate: number }>>({});

  const years = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 7 }, (_, index) => current - 3 + index);
  }, []);

  const loadPeople = async () => {
    const ordered = await supabase
      .from('people')
      .select('id, name, role, color, order_position')
      .eq('project_id', projectId)
      .eq('hide_in_reports', false)
      .order('order_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (!ordered.error) {
      setPeople((ordered.data || []) as TeamPerson[]);
      return;
    }

    const fallback = await supabase
      .from('people')
      .select('id, name, role, color')
      .eq('project_id', projectId)
      .eq('hide_in_reports', false)
      .order('created_at', { ascending: true });

    if (fallback.error) throw fallback.error;
    setPeople((fallback.data || []) as TeamPerson[]);
  };

  const loadHours = async () => {
    const start = formatDateKey(year, month, 1);
    const end = formatDateKey(year, month, new Date(year, month, 0).getDate());
    const { data, error } = await supabase
      .from('project_time_entries')
      .select('person_id, hours')
      .eq('project_id', projectId)
      .gte('entry_date', start)
      .lte('entry_date', end);

    if (error) throw error;

    const totals = (data || []).reduce((acc, row) => {
      acc[row.person_id] = (acc[row.person_id] || 0) + Number(row.hours || 0);
      return acc;
    }, {} as Record<string, number>);

    setHoursByPerson(totals);
  };

  const loadRates = async () => {
    const { data, error } = await supabase
      .from('person_billing_rates')
      .select('person_id, year, month, cost_rate, sale_rate')
      .eq('project_id', projectId);

    if (error) throw error;

    const selectedMonthKey = year * 100 + month;
    const latest = (data || []).reduce((acc, rate) => {
      const key = rate.year === null ? -1 : Number(rate.year) * 100 + Number(rate.month);
      if (key > selectedMonthKey || key < (acc[rate.person_id]?.key ?? -2)) return acc;

      acc[rate.person_id] = {
        key,
        value: {
          costRate: Number(rate.cost_rate || 0),
          saleRate: Number(rate.sale_rate || 0),
        },
      };
      return acc;
    }, {} as Record<string, { key: number; value: { costRate: number; saleRate: number } }>);

    setRatesByPerson(Object.fromEntries(Object.entries(latest).map(([personId, entry]) => [personId, entry.value])));
  };

  const loadData = async () => {
    try {
      await Promise.all([loadPeople(), loadHours(), loadRates()]);
    } catch (error) {
      console.error('Error loading costs:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los costes',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, month, year]);

  const rows = people.map(person => {
    const hours = hoursByPerson[person.id] || 0;
    const rates = ratesByPerson[person.id] || { costRate: 0, saleRate: 0 };
    const cost = hours * rates.costRate;
    const sale = hours * rates.saleRate;
    const margin = sale > 0 ? ((sale - cost) / sale) * 100 : null;
    return { person, hours, rates, cost, sale, margin };
  });

  const totals = rows.reduce((acc, row) => ({
    hours: acc.hours + row.hours,
    cost: acc.cost + row.cost,
    sale: acc.sale + row.sale,
  }), { hours: 0, cost: 0, sale: 0 });

  const totalMargin = totals.sale > 0 ? ((totals.sale - totals.cost) / totals.sale) * 100 : null;

  const exportCosts = () => {
    const exportRows = rows.map(row => ({
      Persona: row.person.name,
      Horas: row.hours,
      'Tasa coste (€/h)': row.rates.costRate,
      'Tasa venta (€/h)': row.rates.saleRate,
      Coste: row.cost,
      Venta: row.sale,
      Margen: row.margin === null ? '' : `${formatPercent(row.margin)}%`,
    }));
    exportRows.push({
      Persona: 'TOTAL',
      Horas: totals.hours,
      'Tasa coste (€/h)': '',
      'Tasa venta (€/h)': '',
      Coste: totals.cost,
      Venta: totals.sale,
      Margen: totalMargin === null ? '' : `${formatPercent(totalMargin)}%`,
    } as any);

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Costes');
    XLSX.writeFile(workbook, `costes-${year}-${String(month).padStart(2, '0')}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <CardTitle>Costes</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" onClick={exportCosts}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <div className="space-y-1">
              <Label>Mes</Label>
              <Select value={String(month)} onValueChange={value => setMonth(Number(value))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Año</Label>
              <Select value={String(year)} onValueChange={value => setYear(Number(value))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(option => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            No hay personas en Gestión del equipo.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">Persona</th>
                  <th className="px-3 py-2 text-right font-medium">Horas</th>
                  <th className="px-3 py-2 text-right font-medium">Tasa coste (€/h)</th>
                  <th className="px-3 py-2 text-right font-medium">Tasa venta (€/h)</th>
                  <th className="px-3 py-2 text-right font-medium">Coste</th>
                  <th className="px-3 py-2 text-right font-medium">Venta</th>
                  <th className="px-3 py-2 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ person, hours, rates, cost, sale, margin }) => {
                  return (
                    <tr key={person.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: person.color }} />
                          <div>
                            <div className="font-medium">{person.name}</div>
                            <div className="text-xs text-muted-foreground">{person.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{hours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(rates.costRate)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(rates.saleRate)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(cost)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(sale)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex min-w-[72px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${getMarginTone(margin)}`}>
                          {margin === null ? '-' : `${formatPercent(margin)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-right">{totals.hours.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.cost)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.sale)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-flex min-w-[72px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${getMarginTone(totalMargin)}`}>
                      {totalMargin === null ? '-' : `${formatPercent(totalMargin)}%`}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
