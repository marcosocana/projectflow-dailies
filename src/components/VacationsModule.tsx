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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useVacations } from '@/hooks/useVacations';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
interface VacationsModuleProps {
  projectId: string;
}
interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
}
export default function VacationsModule({
  projectId
}: VacationsModuleProps) {
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const {
    vacations,
    loading,
    createVacation,
    updateVacation,
    deleteVacation,
    refetch
  } = useVacations(projectId);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [people, setPeople] = useState<Person[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    personId: '',
    startDate: new Date(),
    endDate: new Date(),
    description: '',
    type: 'vacaciones' as 'vacaciones' | 'baja'
  });
  const [editingVacation, setEditingVacation] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    personId: '',
    startDate: new Date(),
    endDate: new Date(),
    description: '',
    type: 'vacaciones' as 'vacaciones' | 'baja'
  });

  // Fetch people from dailies (members)
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('people').select('*').eq('project_id', projectId).order('name');
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
      return isWithinInterval(date, {
        start: startDate,
        end: endDate
      });
    });
  };

  // Get person info
  const getPersonById = (personId: string) => {
    return people.find(p => p.id === personId);
  };

  // Colors for a date based on vacations' person colors
  const getColorsForDate = (date: Date) => {
    const dayVacs = getVacationsForDate(date);
    const colors = dayVacs.map(v => getPersonById(v.person_id || '')?.color).filter(Boolean) as string[];
    const unique = Array.from(new Set(colors));
    return unique.slice(0, 3);
  };

  // Custom day content with colored dots
  const DayContent = (props: any) => {
    const {
      date
    } = props;
    const day = format(date, 'd');
    const colors = getColorsForDate(date);
    return <div className="flex flex-col items-center justify-center">
        <span>{day}</span>
        {colors.length > 0 && <div className="mt-0.5 flex gap-1">
            {colors.map((c, idx) => <span key={idx} className="inline-block w-1.5 h-1.5 rounded-full" style={{
          backgroundColor: c
        }} />)}
          </div>}
      </div>;
  };
  const openEdit = (vacation: any) => {
    setEditingVacation(vacation);
    setEditForm({
      personId: vacation.person_id || '',
      startDate: parseISO(vacation.start_date),
      endDate: parseISO(vacation.end_date),
      description: vacation.description || '',
      type: vacation.type === 'baja' ? 'baja' : 'vacaciones'
    });
  };
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVacation) return;
    try {
      await updateVacation(editingVacation.id, {
        person_id: editForm.personId || null,
        start_date: format(editForm.startDate, 'yyyy-MM-dd'),
        end_date: format(editForm.endDate, 'yyyy-MM-dd'),
        description: editForm.description || null,
        type: editForm.type
      });
      setEditingVacation(null);
      toast({
        title: 'Éxito',
        description: 'Ausencia actualizada'
      });
    } catch (error) {
      console.error('Error updating vacation:', error);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado para crear vacaciones",
        variant: "destructive"
      });
      return;
    }
    try {
      await createVacation({
        user_id: user.id,
        project_id: projectId,
        person_id: form.personId,
        start_date: format(form.startDate, 'yyyy-MM-dd'),
        end_date: format(form.endDate, 'yyyy-MM-dd'),
        description: form.description || null,
        type: form.type
      });
      setCreateOpen(false);
      setForm({
        personId: '',
        startDate: new Date(),
        endDate: new Date(),
        description: '',
        type: 'vacaciones'
      });
      toast({
        title: "Éxito",
        description: "Ausencia registrada correctamente"
      });
    } catch (error) {
      console.error('Error creating vacation:', error);
    }
  };
  const handleDeleteAllVacations = async () => {
    const confirmed = confirm('¿Eliminar todas las ausencias de este proyecto? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      const {
        error
      } = await supabase.from('vacations').delete().eq('project_id', projectId);
      if (error) throw error;
      await refetch();
        toast({
        title: 'Éxito',
        description: 'Todas las ausencias han sido eliminadas.'
      });
    } catch (error: any) {
        toast({
        title: 'Error',
        description: error.message || 'No se pudieron eliminar las ausencias',
        variant: 'destructive'
      });
    }
  };
  const dayVacations = getVacationsForDate(selectedDate);
  return <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestión de ausencias</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleDeleteAllVacations}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar todas
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Añadir ausencia
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Calendar */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Calendario</h3>
              <Calendar mode="single" selected={selectedDate} onSelect={date => date && setSelectedDate(date)} locale={es} className="rounded-md border p-3 pointer-events-auto w-full mx-auto px-[50px]" components={{
              DayContent: DayContent as any
            }} />
            </div>

            {/* Selected date info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {format(selectedDate, 'EEEE, d MMMM yyyy', {
                locale: es
              })}
              </h3>
              
              {dayVacations.length === 0 ? <p className="text-muted-foreground">No hay ausencias en esta fecha</p> : <div className="space-y-3">
                  {dayVacations.map(vacation => {
                const person = getPersonById(vacation.person_id || '');
                return <Card key={vacation.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{
                        backgroundColor: person?.color || 'hsl(var(--primary))'
                      }} />
                            <div>
                              <p className="font-medium">{person?.name || 'Usuario en ausencia'}</p>
                              <p className="text-sm text-muted-foreground">{person?.role || ''}</p>
                               <p className="text-xs text-muted-foreground">
                                 {format(parseISO(vacation.start_date), 'd MMM', {
                            locale: es
                           })} - {format(parseISO(vacation.end_date), 'd MMM', {
                            locale: es
                           })} • {vacation.type === 'baja' ? 'Baja' : 'Vacaciones'}
                               </p>
                              {vacation.description && <p className="text-sm mt-1">{vacation.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(vacation)}>
                              Editar
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteVacation(vacation.id)}>
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </Card>;
              })}
                </div>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create vacation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Ausencia</DialogTitle>
            <DialogDescription>
              Registra las ausencias de un miembro del equipo
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="person">Miembro del Equipo</Label>
              <Select value={form.personId} onValueChange={value => setForm({
              ...form,
              personId: value
            })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un miembro" />
                </SelectTrigger>
                <SelectContent>
                  {people.map(person => <SelectItem key={person.id} value={person.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{
                      backgroundColor: person.color
                    }} />
                        {person.name} - {person.role}
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de ausencia</Label>
              <div className="flex items-center gap-3">
                <Label htmlFor="type-switch" className="text-sm">Vacaciones</Label>
                <Switch
                  id="type-switch"
                  checked={form.type === 'baja'}
                  onCheckedChange={(checked) => setForm({...form, type: checked ? 'baja' : 'vacaciones'})}
                />
                <Label htmlFor="type-switch" className="text-sm">Baja</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de Inicio</Label>
                <Input type="date" value={format(form.startDate, 'yyyy-MM-dd')} onChange={e => setForm({
                ...form,
                startDate: new Date(e.target.value)
              })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de Fin</Label>
                <Input type="date" value={format(form.endDate, 'yyyy-MM-dd')} onChange={e => setForm({
                ...form,
                endDate: new Date(e.target.value)
              })} required />
              </div>
            </div>

            {form.type === 'baja' && (
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea 
                  id="description" 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="Descripción de la baja" 
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Registrar Ausencia
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit vacation dialog */}
      <Dialog open={!!editingVacation} onOpenChange={open => !open && setEditingVacation(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Vacación</DialogTitle>
            <DialogDescription>Actualiza los datos de la vacación</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-person">Miembro del Equipo</Label>
              <Select value={editForm.personId} onValueChange={value => setEditForm({
              ...editForm,
              personId: value
            })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un miembro" />
                </SelectTrigger>
                <SelectContent>
                  {people.map(person => <SelectItem key={person.id} value={person.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{
                      backgroundColor: person.color
                    }} />
                        {person.name} - {person.role}
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de ausencia</Label>
              <div className="flex items-center gap-3">
                <Label htmlFor="edit-type-switch" className="text-sm">Vacaciones</Label>
                <Switch
                  id="edit-type-switch"
                  checked={editForm.type === 'baja'}
                  onCheckedChange={(checked) => setEditForm({...editForm, type: checked ? 'baja' : 'vacaciones'})}
                />
                <Label htmlFor="edit-type-switch" className="text-sm">Baja</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Fecha de Inicio</Label>
                <Input type="date" value={format(editForm.startDate, 'yyyy-MM-dd')} onChange={e => setEditForm({
                ...editForm,
                startDate: new Date(e.target.value)
              })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">Fecha de Fin</Label>
                <Input type="date" value={format(editForm.endDate, 'yyyy-MM-dd')} onChange={e => setEditForm({
                ...editForm,
                endDate: new Date(e.target.value)
              })} required />
              </div>
            </div>

            {editForm.type === 'baja' && (
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea 
                  id="edit-description" 
                  value={editForm.description} 
                  onChange={e => setEditForm({...editForm, description: e.target.value})} 
                  placeholder="Descripción de la baja" 
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingVacation(null)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar cambios</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>;
}