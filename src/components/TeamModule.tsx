import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, GripVertical, Trash2, UserPlus, Pencil } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TeamModuleProps {
  projectId: string;
}

interface TeamPerson {
  id: string;
  project_id: string;
  name: string;
  role: string;
  color: string;
  user_id?: string | null;
  order_position?: number | null;
  hide_in_reports?: boolean | null;
}

interface SortablePersonRowProps {
  person: TeamPerson;
  linkedProfile?: { full_name: string; email: string | null };
  rates?: { costRate: string; saleRate: string };
  savingRateKeys: Set<string>;
  onEdit: (person: TeamPerson) => void;
  onDelete: (id: string) => void;
  onRateChange: (personId: string, field: 'costRate' | 'saleRate', value: string) => void;
  onRateBlur: (personId: string, field: 'costRate' | 'saleRate', value: string) => void;
  onToggleHidden: (person: TeamPerson) => void;
}

const SortablePersonRow = ({ person, linkedProfile, rates, savingRateKeys, onEdit, onDelete, onRateChange, onRateBlur, onToggleHidden }: SortablePersonRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: person.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'relative z-50 bg-muted/50' : person.hide_in_reports ? 'bg-muted/40 opacity-70' : undefined}>
      <TableCell className="w-8">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-muted-foreground active:cursor-grabbing"
          aria-label={`Reordenar ${person.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{person.name}</TableCell>
      <TableCell>{person.role}</TableCell>
      <TableCell>{person.user_id ? (linkedProfile?.full_name || 'Vinculado') : 'Sin vincular'}</TableCell>
      <TableCell>{person.user_id ? (linkedProfile?.email || 'Sin email') : '-'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded border"
            style={{ backgroundColor: person.color }}
          />
          <span className="text-sm font-mono">{person.color}</span>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={rates?.costRate || ''}
          disabled={savingRateKeys.has(`${person.id}:costRate`)}
          onChange={event => onRateChange(person.id, 'costRate', event.target.value)}
          onBlur={event => onRateBlur(person.id, 'costRate', event.target.value)}
          className="h-8 w-24"
          placeholder="0"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={rates?.saleRate || ''}
          disabled={savingRateKeys.has(`${person.id}:saleRate`)}
          onChange={event => onRateChange(person.id, 'saleRate', event.target.value)}
          onBlur={event => onRateBlur(person.id, 'saleRate', event.target.value)}
          className="h-8 w-24"
          placeholder="0"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(person)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleHidden(person)}
            title={person.hide_in_reports ? 'Mostrar en imputaciones y costes' : 'Ocultar en imputaciones y costes'}
          >
            {person.hide_in_reports ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(person.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default function TeamModule({ projectId }: TeamModuleProps) {
  const { toast } = useToast();
  const now = new Date();
  const activeYear = now.getFullYear();
  const activeMonth = now.getMonth() + 1;
  const [people, setPeople] = useState<TeamPerson[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [linkedProfiles, setLinkedProfiles] = useState<Record<string, { full_name: string; email: string | null }>>({});
  const [ratesByPerson, setRatesByPerson] = useState<Record<string, { costRate: string; saleRate: string }>>({});
  const [savingRateKeys, setSavingRateKeys] = useState<Set<string>>(new Set());
  const [createPersonOpen, setCreatePersonOpen] = useState(false);
  const [personForm, setPersonForm] = useState({
    name: '',
    role: '',
    color: '#3B82F6'
  });
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    color: '#3B82F6'
  });
  const [manualOrderAvailable, setManualOrderAvailable] = useState(true);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadPeopleRows = async () => {
    const ordered = await supabase
      .from('people')
      .select('*')
      .eq('project_id', projectId)
      .order('order_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (!ordered.error) {
      setManualOrderAvailable(true);
      return ordered.data || [];
    }

    const fallback = await supabase
      .from('people')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    setManualOrderAvailable(false);
    if (fallback.error) throw fallback.error;
    return fallback.data || [];
  };

  const loadPeople = async () => {
    try {
      const rows = await loadPeopleRows();
      setPeople(rows);
      await loadRates(rows.map(person => person.id));

      const userIds = Array.from(new Set(rows.map(person => person.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds as string[]);

        const map = (profileRows || []).reduce((acc, profile) => {
          acc[profile.user_id] = { full_name: profile.full_name, email: profile.email };
          return acc;
        }, {} as Record<string, { full_name: string; email: string | null }>);
        setLinkedProfiles(map);
      } else {
        setLinkedProfiles({});
      }
    } catch {
      setPeople([]);
      setLinkedProfiles({});
    }
  };

  const loadRates = async (personIds: string[]) => {
    if (personIds.length === 0) {
      setRatesByPerson({});
      return;
    }

    const { data, error } = await supabase
      .from('person_billing_rates')
      .select('person_id, year, month, cost_rate, sale_rate')
      .eq('project_id', projectId)
      .in('person_id', personIds);

    if (error) return;

    const latest = (data || []).reduce((acc, rate) => {
      const isRelevant = rate.year === null ||
        Number(rate.year) < activeYear ||
        (Number(rate.year) === activeYear && Number(rate.month) <= activeMonth);
      if (!isRelevant) return acc;

      const key = rate.year === null ? -1 : Number(rate.year) * 100 + Number(rate.month);
      if (key < (acc[rate.person_id]?.key ?? -2)) return acc;

      acc[rate.person_id] = {
        key,
        value: {
          costRate: rate.cost_rate === null ? '' : String(Number(rate.cost_rate)),
          saleRate: rate.sale_rate === null ? '' : String(Number(rate.sale_rate)),
        },
      };
      return acc;
    }, {} as Record<string, { key: number; value: { costRate: string; saleRate: string } }>);

    setRatesByPerson(Object.fromEntries(Object.entries(latest).map(([personId, entry]) => [personId, entry.value])));
  };

  const updateRate = (personId: string, field: 'costRate' | 'saleRate', value: string) => {
    setRatesByPerson(prev => ({
      ...prev,
      [personId]: {
        costRate: prev[personId]?.costRate || '',
        saleRate: prev[personId]?.saleRate || '',
        [field]: value,
      },
    }));
  };

  const saveRate = async (personId: string, field: 'costRate' | 'saleRate', value: string) => {
    const saveKey = `${personId}:${field}`;
    const current = ratesByPerson[personId] || { costRate: '', saleRate: '' };
    const next = { ...current, [field]: value.trim() };
    const costRate = next.costRate === '' ? null : Number(next.costRate);
    const saleRate = next.saleRate === '' ? null : Number(next.saleRate);

    if (
      (costRate !== null && (!Number.isFinite(costRate) || costRate < 0)) ||
      (saleRate !== null && (!Number.isFinite(saleRate) || saleRate < 0))
    ) {
      toast({ title: 'Error', description: 'La tasa debe ser un número positivo', variant: 'destructive' });
      return;
    }

    setSavingRateKeys(prev => new Set(prev).add(saveKey));
    try {
      const { data: existingRows, error: lookupError } = await supabase
        .from('person_billing_rates')
        .select('id')
        .eq('project_id', projectId)
        .eq('person_id', personId)
        .eq('year', activeYear)
        .eq('month', activeMonth)
        .limit(1);

      if (lookupError) throw lookupError;

      const existingId = existingRows?.[0]?.id;
      if (existingId) {
        const { error } = await supabase
          .from('person_billing_rates')
          .update({ cost_rate: costRate, sale_rate: saleRate })
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('person_billing_rates')
          .insert({
            project_id: projectId,
            person_id: personId,
            year: activeYear,
            month: activeMonth,
            cost_rate: costRate,
            sale_rate: saleRate,
          });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving rate:', error);
      toast({ title: 'Error', description: 'No se pudo guardar la tasa', variant: 'destructive' });
    } finally {
      setSavingRateKeys(prev => {
        const nextSet = new Set(prev);
        nextSet.delete(saveKey);
        return nextSet;
      });
    }
  };

  useEffect(() => {
    loadPeople();
  }, [projectId]);

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextOrderPosition = people.length > 0
      ? Math.max(...people.map(person => Number(person.order_position ?? -1))) + 1
      : 0;

    const payload = {
      name: personForm.name,
      role: personForm.role,
      color: personForm.color,
      project_id: projectId,
      ...(manualOrderAvailable ? { order_position: nextOrderPosition } : {}),
    };

    let { error } = await supabase.from('people').insert(payload as any);

    if (error && manualOrderAvailable) {
      const fallbackPayload = {
        name: personForm.name,
        role: personForm.role,
        color: personForm.color,
        project_id: projectId,
      };
      const fallbackResult = await supabase.from('people').insert(fallbackPayload);
      error = fallbackResult.error;
      if (!error) setManualOrderAvailable(false);
    }

    if (error) {
      return toast({
        title: 'Error',
        description: 'No se pudo crear la persona',
        variant: 'destructive'
      });
    }

    setPersonForm({
      name: '',
      role: '',
      color: '#3B82F6'
    });
    setCreatePersonOpen(false);
    loadPeople();
    toast({
      title: 'Éxito',
      description: 'Persona añadida al equipo'
    });
  };

  const deletePerson = async (id: string) => {
    const { error } = await supabase.from('people').delete().eq('id', id);
    if (error) {
      return toast({
        title: 'Error',
        description: 'No se pudo eliminar la persona',
        variant: 'destructive'
      });
    }
    loadPeople();
    toast({
      title: 'Éxito',
      description: 'Persona eliminada del equipo'
    });
  };

  const toggleHidden = async (person: TeamPerson) => {
    const nextHidden = !person.hide_in_reports;
    setPeople(prev => prev.map(row => row.id === person.id ? { ...row, hide_in_reports: nextHidden } : row));

    const { error } = await supabase
      .from('people')
      .update({ hide_in_reports: nextHidden } as any)
      .eq('id', person.id);

    if (error) {
      setPeople(prev => prev.map(row => row.id === person.id ? { ...row, hide_in_reports: person.hide_in_reports } : row));
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la visibilidad',
        variant: 'destructive'
      });
    }
  };

  const openEdit = (person: TeamPerson) => {
    setEditingPerson(person);
    setEditForm({ name: person.name, role: person.role, color: person.color });
    setEditPersonOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (!manualOrderAvailable) {
      toast({
        title: 'Orden no disponible',
        description: 'Falta aplicar la migración de orden del equipo en Supabase.',
        variant: 'destructive'
      });
      return;
    }

    const oldIndex = people.findIndex(person => person.id === active.id);
    const newIndex = people.findIndex(person => person.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousPeople = people;
    const reorderedPeople = arrayMove(people, oldIndex, newIndex).map((person, index) => ({
      ...person,
      order_position: index,
    }));

    setPeople(reorderedPeople);

    const updates = reorderedPeople.map((person, index) =>
      supabase
        .from('people')
        .update({ order_position: index } as any)
        .eq('id', person.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find(result => result.error);

    if (failed) {
      setPeople(previousPeople);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el orden del equipo',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    if (!editingPerson) return;
    if (!editPersonOpen || !editForm.name.trim() || !editForm.role.trim()) return;

    const handler = setTimeout(async () => {
      const { error } = await supabase
        .from('people')
        .update({ name: editForm.name, role: editForm.role, color: editForm.color })
        .eq('id', editingPerson.id);

      if (error) {
        toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
        return;
      }

      setPeople(prev => prev.map(person => person.id === editingPerson.id ? { ...person, ...editForm } : person));
      setEditingPerson((prev: any) => prev ? { ...prev, ...editForm } : prev);
    }, 500);

    return () => clearTimeout(handler);
  }, [editForm, editingPerson?.id, editPersonOpen]);

  const visiblePeople = showHidden ? people : people.filter(person => !person.hide_in_reports);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Gestión del Equipo</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 items-center gap-2 rounded-md border px-3">
                <Switch id="show-hidden-team" checked={showHidden} onCheckedChange={setShowHidden} />
                <Label htmlFor="show-hidden-team" className="cursor-pointer whitespace-nowrap">
                  Ver ocultos
                </Label>
              </div>
              <Button onClick={() => setCreatePersonOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Añadir persona
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visiblePeople.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay personas en el equipo</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Tasa coste</TableHead>
                    <TableHead>Tasa venta</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext items={visiblePeople.map(person => person.id)} strategy={verticalListSortingStrategy}>
                    {visiblePeople.map((person) => (
                      <SortablePersonRow
                        key={person.id}
                        person={person}
                        linkedProfile={person.user_id ? linkedProfiles[person.user_id] : undefined}
                        rates={ratesByPerson[person.id]}
                        savingRateKeys={savingRateKeys}
                        onEdit={openEdit}
                        onDelete={deletePerson}
                        onRateChange={updateRate}
                        onRateBlur={saveRate}
                        onToggleHidden={toggleHidden}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add Person Dialog */}
      <Dialog open={createPersonOpen} onOpenChange={setCreatePersonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir nueva persona</DialogTitle>
            <DialogDescription>
              Añade un nuevo miembro al equipo del proyecto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addPerson} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="person-name">Nombre</Label>
              <Input
                id="person-name"
                value={personForm.name}
                onChange={e => setPersonForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la persona"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-role">Rol</Label>
              <Input
                id="person-role"
                value={personForm.role}
                onChange={e => setPersonForm(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Rol en el proyecto"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="person-color"
                  type="color"
                  value={personForm.color}
                  onChange={e => setPersonForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={personForm.color}
                  onChange={e => setPersonForm(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#3B82F6"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreatePersonOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Añadir persona
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Person Dialog */}
      <Dialog open={editPersonOpen} onOpenChange={setEditPersonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar persona</DialogTitle>
            <DialogDescription>Actualiza la información del miembro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rol</Label>
              <Input
                id="edit-role"
                value={editForm.role}
                onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-color"
                  type="color"
                  value={editForm.color}
                  onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={editForm.color}
                  onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditPersonOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
