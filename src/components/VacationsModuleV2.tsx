import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useVacations } from '@/hooks/useVacations';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format, isWithinInterval, parseISO, addDays, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

interface VacationsModuleV2Props {
  projectId: string;
}

interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
}

interface Vacation {
  id: string;
  person_id: string | null;
  start_date: string;
  end_date: string;
  type: string;
  description: string | null;
}

export default function VacationsModuleV2({ projectId }: VacationsModuleV2Props) {
  const { toast } = useToast();
  const { vacations, loading, createVacation, updateVacation, deleteVacation, refetch } = useVacations(projectId);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [people, setPeople] = useState<Person[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    personId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    description: '',
    type: 'vacation'
  });
  const [editingVacation, setEditingVacation] = useState<Vacation | null>(null);

  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const { data, error } = await supabase
          .from('people')
          .select('*')
          .eq('project_id', projectId)
          .order('name');

        if (error) throw error;
        setPeople(data || []);
      } catch (error: any) {
        console.error('Error fetching people:', error);
      }
    };

    fetchPeople();
  }, [projectId]);

  // Get vacations for selected date
  const getVacationsForDate = (date: Date) => {
    return vacations.filter(vacation => {
      const startDate = parseISO(vacation.start_date);
      const endDate = parseISO(vacation.end_date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  };

  const getPersonById = (personId: string | null) => {
    return people.find(p => p.id === personId);
  };

  const vacationsForSelectedDate = getVacationsForDate(selectedDate);

  const handleCreateVacation = async () => {
    if (!form.personId || !form.startDate || !form.endDate) {
      toast({ title: 'Error', description: 'Completa todos los campos' });
      return;
    }

    try {
      await createVacation({
        person_id: form.personId,
        start_date: form.startDate,
        end_date: form.endDate,
        description: form.description,
        type: form.type
      });

      toast({ title: 'Éxito', description: 'Ausencia creada' });
      setCreateOpen(false);
      setForm({
        personId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        description: '',
        type: 'vacation'
      });
      refetch();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo crear la ausencia' });
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (!confirm('¿Eliminar esta ausencia?')) return;

    try {
      await deleteVacation(id);
      toast({ title: 'Éxito', description: 'Ausencia eliminada' });
      refetch();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar' });
    }
  };

  return (
    <div className="space-y-4 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Ausencias</span>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva ausencia
          </Button>
        </CardTitle>
      </CardHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Calendario Fixed - Izquierda */}
        <div className="lg:col-span-1">
          <Card className="sticky top-0">
            <CardContent className="pt-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="w-full"
                locale={es}
              />
              <div className="mt-4 text-sm text-muted-foreground">
                <p className="font-semibold mb-2">
                  {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listado de Personas - Derecha */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">
                Personas ausentes ({vacationsForSelectedDate.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {loading ? (
                <p className="text-muted-foreground text-sm">Cargando...</p>
              ) : vacationsForSelectedDate.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin ausencias este día</p>
              ) : (
                vacationsForSelectedDate.map((vacation) => {
                  const person = getPersonById(vacation.person_id);
                  if (!person) return null;

                  return (
                    <div
                      key={vacation.id}
                      className="p-3 rounded-lg border flex items-center justify-between"
                      style={{ borderColor: person.color, backgroundColor: `${person.color}15` }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: person.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{person.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(vacation.start_date), 'd MMM', { locale: es })}
                            {' → '}
                            {format(parseISO(vacation.end_date), 'd MMM', { locale: es })}
                          </p>
                          {vacation.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {vacation.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingVacation(vacation)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDeleteVacation(vacation.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Todas las ausencias del mes */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
                  Todas las ausencias
                </p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {vacations.slice(0, 10).map((vacation) => {
                    const person = getPersonById(vacation.person_id);
                    if (!person) return null;

                    return (
                      <div
                        key={vacation.id}
                        className="text-xs p-2 rounded border flex items-center justify-between group hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: person.color }}
                          />
                          <span className="truncate">{person.name}</span>
                          <span className="text-muted-foreground flex-shrink-0">
                            {format(parseISO(vacation.start_date), 'd/M')} - {format(parseISO(vacation.end_date), 'd/M')}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() => handleDeleteVacation(vacation.id)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Nueva Ausencia */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva ausencia</DialogTitle>
            <DialogDescription>Registra una ausencia o vacaciones</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="person">Persona</Label>
              <select
                id="person"
                className="w-full mt-2 px-3 py-2 border rounded-md"
                value={form.personId}
                onChange={(e) => setForm({ ...form, personId: e.target.value })}
              >
                <option value="">Selecciona una persona</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                className="w-full mt-2 px-3 py-2 border rounded-md"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="vacation">Vacaciones</option>
                <option value="sick">Enfermedad</option>
                <option value="personal">Personal</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">Desde</Label>
                <Input
                  id="start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="end">Hasta</Label>
                <Input
                  id="end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Notas (opcional)</Label>
              <textarea
                id="description"
                className="w-full mt-2 px-3 py-2 border rounded-md text-sm"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Motivo, detalles, etc..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateVacation}>Crear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
