import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, Wand2 } from 'lucide-react';

interface TimeTrackingModuleProps {
  projectId: string;
}

interface TeamPerson {
  id: string;
  name: string;
  role: string;
  color: string;
  order_position?: number | null;
}

interface TimeEntry {
  id: string;
  person_id: string;
  entry_date: string;
  hours: number;
  is_holiday: boolean;
}

const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
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

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function TimeTrackingModule({ projectId }: TimeTrackingModuleProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === 'mocanat@minsait.com';
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [people, setPeople] = useState<TeamPerson[]>([]);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [monthLocked, setMonthLocked] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const editingDisabled = monthLocked && !isAdmin;

  const days = useMemo(() => {
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month - 1, day);
      const weekDay = date.getDay();
      return {
        day,
        dateKey: formatDateKey(year, month, day),
        weekDay,
        label: WEEKDAY_LABELS[weekDay],
        isWeekend: weekDay === 0 || weekDay === 6,
      };
    });
  }, [month, year]);

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

  const loadEntries = async () => {
    const start = formatDateKey(year, month, 1);
    const end = formatDateKey(year, month, days.length);
    const { data, error } = await supabase
      .from('project_time_entries')
      .select('id, person_id, entry_date, hours, is_holiday')
      .eq('project_id', projectId)
      .gte('entry_date', start)
      .lte('entry_date', end);

    if (error) throw error;

    const nextEntries = (data || []).reduce((acc, entry) => {
      const row = entry as TimeEntry;
      acc[`${row.person_id}:${row.entry_date}`] = row.is_holiday ? 'X' : String(Number(row.hours));
      return acc;
    }, {} as Record<string, string>);

    setEntries(nextEntries);
  };

  const loadMonthLock = async () => {
    const { data, error } = await supabase
      .from('project_time_month_locks')
      .select('locked')
      .eq('project_id', projectId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (error) throw error;
    setMonthLocked(Boolean(data?.locked));
  };

  const loadData = async () => {
    try {
      await Promise.all([loadPeople(), loadEntries(), loadMonthLock()]);
    } catch (error) {
      console.error('Error loading time tracking data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las imputaciones',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, month, year]);

  const saveEntry = async (personId: string, dateKey: string, rawValue: string) => {
    if (editingDisabled) return;
    const entryKey = `${personId}:${dateKey}`;
    const trimmed = rawValue.trim();

    setSavingKeys(prev => new Set(prev).add(entryKey));
    try {
      if (!trimmed) {
        const { error } = await supabase
          .from('project_time_entries')
          .delete()
          .eq('project_id', projectId)
          .eq('person_id', personId)
          .eq('entry_date', dateKey);
        if (error) throw error;
        return;
      }

      const isHoliday = trimmed.toUpperCase() === 'X';
      const hours = isHoliday ? 0 : Number(trimmed);
      if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
        throw new Error('invalid-hours');
      }

      const { error } = await supabase
        .from('project_time_entries')
        .upsert({
          project_id: projectId,
          person_id: personId,
          entry_date: dateKey,
          hours,
          is_holiday: isHoliday,
        }, { onConflict: 'project_id,person_id,entry_date' });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving time entry:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la imputación',
        variant: 'destructive',
      });
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(entryKey);
        return next;
      });
    }
  };

  const updateLocalEntry = (personId: string, dateKey: string, value: string) => {
    if (!/^(x|X|\d{0,2}([.,]\d{0,2})?)?$/.test(value)) return;
    const entryKey = `${personId}:${dateKey}`;
    const normalized = value.toUpperCase() === 'X' ? 'X' : value.replace(',', '.');
    setEntries(prev => ({ ...prev, [entryKey]: normalized }));
  };

  const fillPersonMonth = async (personId: string) => {
    if (editingDisabled) return;
    const weekdayDays = days.filter(day => !day.isWeekend);
    const nextValues = Object.fromEntries(
      weekdayDays.map(day => [
        `${personId}:${day.dateKey}`,
        day.weekDay === 5 ? '7' : '9',
      ]),
    );

    setEntries(prev => ({ ...prev, ...nextValues }));
    setSavingKeys(prev => {
      const next = new Set(prev);
      weekdayDays.forEach(day => next.add(`${personId}:${day.dateKey}`));
      return next;
    });

    try {
      const rows = weekdayDays.map(day => ({
        project_id: projectId,
        person_id: personId,
        entry_date: day.dateKey,
        hours: day.weekDay === 5 ? 7 : 9,
        is_holiday: false,
      }));

      const { error } = await supabase
        .from('project_time_entries')
        .upsert(rows, { onConflict: 'project_id,person_id,entry_date' });

      if (error) throw error;
    } catch (error) {
      console.error('Error filling time entries:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron completar las horas',
        variant: 'destructive',
      });
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        weekdayDays.forEach(day => next.delete(`${personId}:${day.dateKey}`));
        return next;
      });
    }
  };

  const clearPersonMonth = async (personId: string) => {
    if (editingDisabled) return;
    const monthDays = days.map(day => `${personId}:${day.dateKey}`);
    setEntries(prev => {
      const next = { ...prev };
      monthDays.forEach(key => delete next[key]);
      return next;
    });
    setSavingKeys(prev => {
      const next = new Set(prev);
      monthDays.forEach(key => next.add(key));
      return next;
    });

    try {
      const start = formatDateKey(year, month, 1);
      const end = formatDateKey(year, month, days.length);
      const { error } = await supabase
        .from('project_time_entries')
        .delete()
        .eq('project_id', projectId)
        .eq('person_id', personId)
        .gte('entry_date', start)
        .lte('entry_date', end);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing time entries:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar las imputaciones',
        variant: 'destructive',
      });
      loadEntries();
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        monthDays.forEach(key => next.delete(key));
        return next;
      });
    }
  };

  const toggleMonthLock = async (locked: boolean) => {
    setMonthLocked(locked);
    setSavingLock(true);
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('project_time_month_locks')
        .select('id')
        .eq('project_id', projectId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existing?.id) {
        const { error } = await supabase
          .from('project_time_month_locks')
          .update({ locked })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_time_month_locks')
          .insert({ project_id: projectId, year, month, locked });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving month lock:', error);
      setMonthLocked(!locked);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el cierre del mes',
        variant: 'destructive',
      });
    } finally {
      setSavingLock(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <CardTitle>Imputaciones</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            {isAdmin && (
              <div className="flex h-10 items-center gap-2 rounded-md border px-3">
                <Switch
                  id="month-lock"
                  checked={monthLocked}
                  disabled={savingLock}
                  onCheckedChange={toggleMonthLock}
                />
                <Label htmlFor="month-lock" className="cursor-pointer whitespace-nowrap">
                  Cerrar mes
                </Label>
              </div>
            )}
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
        <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Leyenda:</span> escribe <span className="font-mono font-semibold text-foreground">X</span> para marcar festivo. Equivale a 0 horas.
        </div>
        {people.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            No hay personas en Gestión del equipo.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 z-20 min-w-[220px] bg-muted px-3 py-2 text-left font-medium">
                    Persona
                  </th>
                  {days.map(day => (
                    <th
                      key={day.dateKey}
                      className={`min-w-[58px] border-l px-1 py-2 text-center font-medium ${day.isWeekend ? 'bg-muted text-muted-foreground' : ''}`}
                    >
                      <div>{day.day}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">{day.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map(person => (
                  <tr key={person.id} className="border-b last:border-b-0">
                    <td className="sticky left-0 z-10 min-w-[220px] bg-background px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: person.color }}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{person.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{person.role}</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-7 w-7 shrink-0"
                          onClick={() => fillPersonMonth(person.id)}
                          disabled={editingDisabled}
                          aria-label={`Completar horas de ${person.name}`}
                          title="Completar fila"
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => clearPersonMonth(person.id)}
                          disabled={editingDisabled}
                          aria-label={`Eliminar imputaciones de ${person.name}`}
                          title="Eliminar fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    {days.map(day => {
                      const entryKey = `${person.id}:${day.dateKey}`;
                      const value = entries[entryKey] ?? '';
                      const completed = value.trim() !== '';
                      const isHoliday = value.trim().toUpperCase() === 'X';
                      return (
                        <td
                          key={entryKey}
                          className={`border-l p-1 ${day.isWeekend || isHoliday ? 'bg-muted/70' : ''}`}
                        >
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            disabled={day.isWeekend || editingDisabled || savingKeys.has(entryKey)}
                            onChange={event => updateLocalEntry(person.id, day.dateKey, event.target.value)}
                            onBlur={event => saveEntry(person.id, day.dateKey, event.target.value)}
                            className={`h-8 w-[52px] px-1 text-center text-xs ${day.isWeekend || isHoliday ? 'bg-muted text-muted-foreground' : completed ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
