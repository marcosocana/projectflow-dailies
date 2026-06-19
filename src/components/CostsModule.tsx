import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
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

interface CostTag {
  id: string;
  name: string;
  color: string;
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

const NO_TAG_VALUE = '__none__';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const formatHours = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);

const formatPercent = (value: number | null) =>
  value === null
    ? '-'
    : `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`;

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
  const [soldHoursByPerson, setSoldHoursByPerson] = useState<Record<string, string>>({});
  const [tagsByPerson, setTagsByPerson] = useState<Record<string, string>>({});
  const [costTags, setCostTags] = useState<CostTag[]>([]);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0f766e');
  const [savingSoldPersonIds, setSavingSoldPersonIds] = useState<Set<string>>(new Set());
  const [savingTagPersonIds, setSavingTagPersonIds] = useState<Set<string>>(new Set());
  const [savingCatalogTagIds, setSavingCatalogTagIds] = useState<Set<string>>(new Set());
  const [creatingTag, setCreatingTag] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const loadMetrics = async () => {
    const { data, error } = await supabase
      .from('project_time_month_person_metrics')
      .select('person_id, sold_hours, cost_tag')
      .eq('project_id', projectId)
      .eq('year', year)
      .eq('month', month);

    if (error) throw error;

    setSoldHoursByPerson(
      Object.fromEntries((data || []).filter(row => row.sold_hours !== null).map(row => [row.person_id, String(Number(row.sold_hours || 0))])),
    );
    setTagsByPerson(
      Object.fromEntries((data || []).map(row => [row.person_id, row.cost_tag || ''])),
    );
  };

  const loadCostTags = async () => {
    const { data, error } = await supabase
      .from('project_cost_tags')
      .select('id, name, color')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const nextTags = (data || []) as CostTag[];
    setCostTags(nextTags);
    setTagDrafts(Object.fromEntries(nextTags.map(tag => [tag.id, { name: tag.name, color: tag.color }])));
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
    setRefreshing(true);
    try {
      await Promise.all([loadPeople(), loadHours(), loadRates(), loadMetrics(), loadCostTags()]);
    } catch (error) {
      console.error('Error loading costs:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los costes',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, month, year]);

  const updateSoldHours = (personId: string, value: string) => {
    if (!/^\d{0,4}([.,]\d{0,2})?$/.test(value)) return;
    setSoldHoursByPerson(prev => ({ ...prev, [personId]: value.replace(',', '.') }));
  };

  const getSoldHours = (personId: string) => {
    const totalHours = hoursByPerson[personId] || 0;
    const rawValue = soldHoursByPerson[personId];
    if (rawValue === undefined || rawValue.trim() === '') return totalHours;

    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? Math.max(numericValue, 0) : totalHours;
  };

  const saveSoldHours = async (personId: string) => {
    const rawValue = soldHoursByPerson[personId];
    const shouldUseDefault = rawValue === undefined || rawValue.trim() === '';
    const soldHours = shouldUseDefault ? null : getSoldHours(personId);

    setSoldHoursByPerson(prev => {
      const next = { ...prev };
      if (soldHours === null) {
        delete next[personId];
      } else {
        next[personId] = String(soldHours);
      }
      return next;
    });
    setSavingSoldPersonIds(prev => new Set(prev).add(personId));

    try {
      const { error } = await supabase
        .from('project_time_month_person_metrics')
        .upsert({
          project_id: projectId,
          person_id: personId,
          year,
          month,
          sold_hours: soldHours,
        }, { onConflict: 'project_id,person_id,year,month' });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving sold hours:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las horas vendidas',
        variant: 'destructive',
      });
    } finally {
      setSavingSoldPersonIds(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    }
  };

  const saveTag = async (personId: string, tag: string) => {
    const normalizedTag = tag.trim();
    setTagsByPerson(prev => ({ ...prev, [personId]: normalizedTag }));
    setSavingTagPersonIds(prev => new Set(prev).add(personId));

    try {
      const { error } = await supabase
        .from('project_time_month_person_metrics')
        .upsert({
          project_id: projectId,
          person_id: personId,
          year,
          month,
          cost_tag: normalizedTag || null,
        }, { onConflict: 'project_id,person_id,year,month' });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving cost tag:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la etiqueta',
        variant: 'destructive',
      });
    } finally {
      setSavingTagPersonIds(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    }
  };

  const selectTag = (personId: string, value: string) => {
    saveTag(personId, value === NO_TAG_VALUE ? '' : value);
  };

  const createCostTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    setCreatingTag(true);
    try {
      const { error } = await supabase
        .from('project_cost_tags')
        .insert({ project_id: projectId, name, color: newTagColor });

      if (error) throw error;

      setNewTagName('');
      setNewTagColor('#0f766e');
      await loadCostTags();
    } catch (error) {
      console.error('Error creating cost tag:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la etiqueta',
        variant: 'destructive',
      });
    } finally {
      setCreatingTag(false);
    }
  };

  const updateCostTag = async (tagId: string) => {
    const draft = tagDrafts[tagId];
    const tag = costTags.find(item => item.id === tagId);
    const name = draft?.name.trim();
    if (!draft || !tag || !name) return;

    setSavingCatalogTagIds(prev => new Set(prev).add(tagId));
    try {
      const { error } = await supabase
        .from('project_cost_tags')
        .update({ name, color: draft.color })
        .eq('id', tagId);

      if (error) throw error;

      if (tag.name !== name) {
        await supabase
          .from('project_time_month_person_metrics')
          .update({ cost_tag: name })
          .eq('project_id', projectId)
          .eq('cost_tag', tag.name);
      }

      await Promise.all([loadCostTags(), loadMetrics()]);
    } catch (error) {
      console.error('Error updating cost tag:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la etiqueta',
        variant: 'destructive',
      });
    } finally {
      setSavingCatalogTagIds(prev => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    }
  };

  const deleteCostTag = async (tag: CostTag) => {
    setSavingCatalogTagIds(prev => new Set(prev).add(tag.id));
    try {
      const clearResult = await supabase
        .from('project_time_month_person_metrics')
        .update({ cost_tag: null })
        .eq('project_id', projectId)
        .eq('cost_tag', tag.name);

      if (clearResult.error) throw clearResult.error;

      const { error } = await supabase
        .from('project_cost_tags')
        .delete()
        .eq('id', tag.id);

      if (error) throw error;

      await Promise.all([loadCostTags(), loadMetrics()]);
    } catch (error) {
      console.error('Error deleting cost tag:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la etiqueta',
        variant: 'destructive',
      });
    } finally {
      setSavingCatalogTagIds(prev => {
        const next = new Set(prev);
        next.delete(tag.id);
        return next;
      });
    }
  };

  const getTagStyle = (tagName: string) => {
    const tag = costTags.find(item => item.name === tagName);
    return tag
      ? { borderColor: tag.color, backgroundColor: `${tag.color}1A`, color: tag.color }
      : undefined;
  };

  const getTagTriggerStyle = (tagName: string) =>
    getTagStyle(tagName) ?? { borderColor: '#cbd5e1', backgroundColor: '#f8fafc', color: '#475569' };

  const rows = people.map(person => {
    const totalHours = hoursByPerson[person.id] || 0;
    const soldHours = getSoldHours(person.id);
    const uncoveredHours = Math.max(totalHours - soldHours, 0);
    const rates = ratesByPerson[person.id] || { costRate: 0, saleRate: 0 };
    const cost = totalHours * rates.costRate;
    const sale = soldHours * rates.saleRate;
    const performance = sale - cost;
    const margin = sale > 0 ? (1 - cost / sale) * 100 : null;
    return { person, soldHours, uncoveredHours, totalHours, rates, cost, sale, performance, margin };
  });

  const totals = rows.reduce((acc, row) => ({
    soldHours: acc.soldHours + row.soldHours,
    uncoveredHours: acc.uncoveredHours + row.uncoveredHours,
    totalHours: acc.totalHours + row.totalHours,
    cost: acc.cost + row.cost,
    sale: acc.sale + row.sale,
    performance: acc.performance + row.performance,
  }), { soldHours: 0, uncoveredHours: 0, totalHours: 0, cost: 0, sale: 0, performance: 0 });

  const totalMargin = totals.sale > 0 ? (1 - totals.cost / totals.sale) * 100 : null;

  const exportCosts = () => {
    const exportRows = rows.map(row => ({
      Persona: row.person.name,
      Etiqueta: tagsByPerson[row.person.id] || '',
      'Horas vendidas': row.soldHours,
      'Horas sin cubrir': row.uncoveredHours,
      'Total imputadas': row.totalHours,
      Coste: row.cost,
      Venta: row.sale,
      Rendimiento: row.performance,
      Margen: formatPercent(row.margin),
    }));
    exportRows.push({
      Persona: 'TOTAL',
      'Horas vendidas': totals.soldHours,
      'Horas sin cubrir': totals.uncoveredHours,
      'Total imputadas': totals.totalHours,
      Coste: totals.cost,
      Venta: totals.sale,
      Rendimiento: totals.performance,
      Margen: formatPercent(totalMargin),
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
            <Button variant="outline" onClick={() => setTagsDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar etiquetas
            </Button>
            <Button variant="outline" onClick={loadData} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
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
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">Persona</th>
                  <th className="px-3 py-2 text-left font-medium">Etiqueta</th>
                  <th className="px-3 py-2 text-right font-medium">Horas vendidas</th>
                  <th className="px-3 py-2 text-right font-medium">Horas sin cubrir</th>
                  <th className="px-3 py-2 text-right font-medium">Total imputadas</th>
                  <th className="px-3 py-2 text-right font-medium">Coste</th>
                  <th className="px-3 py-2 text-right font-medium">Venta</th>
                  <th className="px-3 py-2 text-right font-medium">Rendimiento</th>
                  <th className="px-3 py-2 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ person, soldHours, uncoveredHours, totalHours, cost, sale, performance, margin }) => {
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
                      <td className="px-3 py-2">
                        <div className="flex min-w-[180px]">
                          <Select
                            value={tagsByPerson[person.id] || NO_TAG_VALUE}
                            onValueChange={value => selectTag(person.id, value)}
                            disabled={savingTagPersonIds.has(person.id)}
                          >
                            <SelectTrigger
                              className="h-8 w-fit min-w-[116px] justify-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold [&>svg]:h-3.5 [&>svg]:w-3.5"
                              style={getTagTriggerStyle(tagsByPerson[person.id] || '')}
                            >
                              <span className="truncate">
                                {tagsByPerson[person.id] || 'Sin etiqueta'}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_TAG_VALUE}>Sin etiqueta</SelectItem>
                              {costTags.map(tag => (
                                <SelectItem key={tag.id} value={tag.name}>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={soldHoursByPerson[person.id] ?? String(totalHours)}
                          disabled={savingSoldPersonIds.has(person.id)}
                          onChange={event => updateSoldHours(person.id, event.target.value)}
                          onBlur={() => saveSoldHours(person.id)}
                          className="ml-auto h-8 w-24 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatHours(uncoveredHours)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatHours(totalHours)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(cost)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(sale)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex min-w-[96px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${performance >= 0 ? 'border-green-200 bg-green-100 text-green-700' : 'border-red-200 bg-red-100 text-red-700'}`}>
                          {formatCurrency(performance)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{formatPercent(margin)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2 text-right">{formatHours(totals.soldHours)}</td>
                  <td className="px-3 py-2 text-right">{formatHours(totals.uncoveredHours)}</td>
                  <td className="px-3 py-2 text-right">{formatHours(totals.totalHours)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.cost)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.sale)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-flex min-w-[96px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${totals.performance >= 0 ? 'border-green-200 bg-green-100 text-green-700' : 'border-red-200 bg-red-100 text-red-700'}`}>
                      {formatCurrency(totals.performance)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{formatPercent(totalMargin)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <Dialog open={tagsDialogOpen} onOpenChange={setTagsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar etiquetas</DialogTitle>
            <DialogDescription>
              Gestiona las etiquetas disponibles para clasificar los costes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
                <div className="space-y-1">
                  <Label>Nueva etiqueta</Label>
                  <Input
                    value={newTagName}
                    onChange={event => setNewTagName(event.target.value)}
                    placeholder="Nombre"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={newTagColor}
                    onChange={event => setNewTagColor(event.target.value)}
                    className="h-10 p-1"
                  />
                </div>
                <Button onClick={createCostTag} disabled={creatingTag || !newTagName.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear
                </Button>
              </div>
            </div>

            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {costTags.length === 0 ? (
                <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
                  No hay etiquetas creadas.
                </div>
              ) : (
                costTags.map(tag => {
                  const draft = tagDrafts[tag.id] || { name: tag.name, color: tag.color };
                  const saving = savingCatalogTagIds.has(tag.id);

                  return (
                    <div key={tag.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_110px_auto_auto] md:items-end">
                      <div className="space-y-1">
                        <Label>Nombre</Label>
                        <Input
                          value={draft.name}
                          disabled={saving}
                          onChange={event => setTagDrafts(prev => ({
                            ...prev,
                            [tag.id]: { ...draft, name: event.target.value },
                          }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Color</Label>
                        <Input
                          type="color"
                          value={draft.color}
                          disabled={saving}
                          onChange={event => setTagDrafts(prev => ({
                            ...prev,
                            [tag.id]: { ...draft, color: event.target.value },
                          }))}
                          className="h-10 p-1"
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => updateCostTag(tag.id)}
                        disabled={saving || !draft.name.trim()}
                      >
                        Guardar
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteCostTag(tag)}
                        disabled={saving}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
