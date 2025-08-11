import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useVacations } from '@/hooks/useVacations';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, User, CalendarIcon } from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface VacationsCalendarModuleProps {
  projectId: string;
}

interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
}

export default function VacationsCalendarModule({ projectId }: VacationsCalendarModuleProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { vacations, loading, createVacation, deleteVacation, refetch } = useVacations(projectId);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [people, setPeople] = useState<Person[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    personId: '',
    startDate: new Date(),
    endDate: new Date(),
    description: ''
  });

  // Fetch people from dailies (members)
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

  // Get person info
  const getPersonById = (personId: string) => {
    return people.find(p => p.id === personId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado para crear vacaciones",
        variant: "destructive",
      });
      return;
    }

    try {
      await createVacation({
        user_id: user.id,
        project_id: projectId,
        start_date: format(form.startDate, 'yyyy-MM-dd'),
        end_date: format(form.endDate, 'yyyy-MM-dd'),
        description: form.description || null,
      });

      setCreateOpen(false);
      setForm({
        personId: '',
        startDate: new Date(),
        endDate: new Date(),
        description: ''
      });

      toast({
        title: "Éxito",
        description: "Vacaciones registradas correctamente",
      });
    } catch (error) {
      console.error('Error creating vacation:', error);
    }
  };

  const dayVacations = getVacationsForDate(selectedDate);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestión de Vacaciones</CardTitle>
            <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Vacación
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Calendar */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Calendario</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={es}
                className={cn("rounded-md border p-3 pointer-events-auto")}
                modifiers={{
                  vacation: (date) => getVacationsForDate(date).length > 0
                }}
                modifiersStyles={{
                  vacation: { 
                    backgroundColor: 'hsl(var(--primary))', 
                    color: 'hsl(var(--primary-foreground))',
                    fontWeight: 'bold'
                  }
                }}
              />
            </div>

            {/* Selected date info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
              </h3>
              
              {dayVacations.length === 0 ? (
                <p className="text-muted-foreground">No hay vacaciones en esta fecha</p>
              ) : (
                <div className="space-y-3">
                  {dayVacations.map((vacation) => {
                    const person = people.find(p => p.id === form.personId); // For now, show the selected person
                    return (
                      <Card key={vacation.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: person?.color || '#3B82F6' }}
                            />
                            <div>
                              <p className="font-medium">{person?.name || 'Usuario en vacaciones'}</p>
                              <p className="text-sm text-muted-foreground">{person?.role || ''}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(vacation.start_date), 'd MMM', { locale: es })} - {format(parseISO(vacation.end_date), 'd MMM', { locale: es })}
                              </p>
                              {vacation.description && (
                                <p className="text-sm mt-1">{vacation.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create vacation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Vacaciones</DialogTitle>
            <DialogDescription>
              Registra las vacaciones de un miembro del equipo
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="person">Miembro del Equipo</Label>
              <Select
                value={form.personId}
                onValueChange={(value) => setForm({ ...form, personId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un miembro" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: person.color }}
                        />
                        {person.name} - {person.role}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de Inicio</Label>
                <Input
                  type="date"
                  value={format(form.startDate, 'yyyy-MM-dd')}
                  onChange={(e) => setForm({ ...form, startDate: new Date(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de Fin</Label>
                <Input
                  type="date"
                  value={format(form.endDate, 'yyyy-MM-dd')}
                  onChange={(e) => setForm({ ...form, endDate: new Date(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción de las vacaciones"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Registrar Vacaciones
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}