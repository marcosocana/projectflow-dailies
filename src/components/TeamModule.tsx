import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, UserPlus, Pencil } from 'lucide-react';

interface TeamModuleProps {
  projectId: string;
}

export default function TeamModule({ projectId }: TeamModuleProps) {
  const { toast } = useToast();
  const [people, setPeople] = useState<any[]>([]);
  const [linkedProfiles, setLinkedProfiles] = useState<Record<string, { full_name: string; email: string | null }>>({});
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

  const loadPeople = async () => {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (!error) {
      const rows = data || [];
      setPeople(rows);

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
    }
  };

  useEffect(() => {
    loadPeople();
  }, [projectId]);

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('people').insert({
      name: personForm.name,
      role: personForm.role,
      color: personForm.color,
      project_id: projectId
    });

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

  const openEdit = (person: any) => {
    setEditingPerson(person);
    setEditForm({ name: person.name, role: person.role, color: person.color });
    setEditPersonOpen(true);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión del Equipo</CardTitle>
            </div>
            <Button onClick={() => setCreatePersonOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Añadir persona
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay personas en el equipo</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell>{person.role}</TableCell>
                    <TableCell>{person.user_id ? (linkedProfiles[person.user_id]?.full_name || 'Vinculado') : 'Sin vincular'}</TableCell>
                    <TableCell>{person.user_id ? (linkedProfiles[person.user_id]?.email || 'Sin email') : '—'}</TableCell>
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(person)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePerson(person.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
