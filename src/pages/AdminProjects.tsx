import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Trash2, Upload, Save, RefreshCcw, ArrowLeft, Eye, EyeOff, UserCog, UserX } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';

interface ProjectRow {
  id: string;
  name: string;
  project_number: number;
  project_password: string;
  dailies_password: string;
  theme_color: string;
  logo_url: string | null;
  created_at: string;
}

interface AdminProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

interface ProjectAccessRow {
  id: string;
  user_id: string;
  project_id: string;
}

interface PersonRow {
  id: string;
  name: string;
  project_id: string;
  user_id: string | null;
  color: string;
}

const projectSections = ['tasks', 'dailies', 'vacations', 'users', 'notes', 'settings'] as const;

const AdminProjects = () => {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [projectAccess, setProjectAccess] = useState<ProjectAccessRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<AdminProfile | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState({ full_name: '', email: '', color: '#3B82F6', is_active: true });
  const [linkedPersonId, setLinkedPersonId] = useState('');
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    project_password: '',
    dailies_password: '',
    theme_color: '#3B82F6',
  });

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isSuperUser = user?.email?.toLowerCase() === 'mocanat@minsait.com';
  const hasAdminPasswordAccess = sessionStorage.getItem('projectflow_admin_access') === 'true';
  const canAccessAdmin = isSuperUser || hasAdminPasswordAccess;

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_number, project_password, dailies_password, theme_color, logo_url, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al cargar proyectos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const [
        { data: profileData, error: profilesError },
        { data: accessData, error: accessError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, email, full_name, color, is_active, created_at')
          .order('full_name'),
        supabase
          .from('project_access')
          .select('id, user_id, project_id'),
      ]);

      if (profilesError) throw profilesError;
      if (accessError) throw accessError;

      const peopleWithLink = await supabase
        .from('people')
        .select('id, name, project_id, user_id, color')
        .order('name');

      if (peopleWithLink.error) throw peopleWithLink.error;

      setProfiles(profileData || []);
      setProjectAccess(accessData || []);
      setPeople(peopleWithLink.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al cargar usuarios",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && canAccessAdmin) {
      load();
      loadUsers();
    }
  }, [authLoading, user, canAccessAdmin]);

  useEffect(() => {
    if (!editingProject || !editOpen || !editForm.name.trim()) return;

    const handler = setTimeout(async () => {
      const updates: any = {
        name: editForm.name.trim(),
        project_password: editForm.project_password.trim(),
        dailies_password: editForm.dailies_password.trim(),
        theme_color: editForm.theme_color,
      };

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', editingProject.id);

      if (error) {
        toast({ title: "Error", description: error.message || "Error al actualizar el proyecto", variant: "destructive" });
        return;
      }

      setProjects(prev => prev.map(project => project.id === editingProject.id ? { ...project, ...updates } : project));
      setEditingProject(prev => prev ? { ...prev, ...updates } : prev);
    }, 500);

    return () => clearTimeout(handler);
  }, [editingProject?.id, editOpen, editForm]);

  useEffect(() => {
    if (!selectedProfile || !userDialogOpen || !userForm.full_name.trim()) return;

    const handler = setTimeout(async () => {
      const updates = {
        full_name: userForm.full_name.trim(),
        email: userForm.email.trim() || null,
        color: userForm.color,
        is_active: userForm.is_active,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', selectedProfile.id);

      if (error) {
        toast({ title: 'Error', description: error.message || 'No se pudo actualizar el usuario', variant: 'destructive' });
        return;
      }

      setProfiles(prev => prev.map(profile => profile.id === selectedProfile.id ? { ...profile, ...updates } : profile));
      setSelectedProfile(prev => prev ? { ...prev, ...updates } : prev);
    }, 500);

    return () => clearTimeout(handler);
  }, [selectedProfile?.id, userDialogOpen, userForm]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!canAccessAdmin) {
    return <Navigate to="/" replace />;
  }

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el proyecto "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Proyecto eliminado",
        description: `El proyecto "${name}" ha sido eliminado`,
      });

      load();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el proyecto",
        variant: "destructive",
      });
    }
  };

  const onEdit = (project: ProjectRow) => {
    setEditingProject(project);
    setEditForm({
      name: project.name,
      project_password: project.project_password,
      dailies_password: project.dailies_password,
      theme_color: project.theme_color,
    });
    setEditOpen(true);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingProject) return;

    // Validaciones de requisitos
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Formato no permitido. Usa JPG, PNG o GIF.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen no puede superar los 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingProject.id}-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('project-logos')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-logos')
        .getPublicUrl(fileName);

      // Guardar inmediatamente en BD
      const { error: updateError } = await supabase
        .from('projects')
        .update({ logo_url: publicUrl })
        .eq('id', editingProject.id);
      if (updateError) throw updateError;

      setEditingProject(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      await load();

      toast({
        title: 'Éxito',
        description: 'Logo subido y guardado correctamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al subir/guardar el logo',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!editingProject) return;
    try {
      const { error } = await supabase
        .from('projects')
        .update({ logo_url: null })
        .eq('id', editingProject.id);
      if (error) throw error;
      setEditingProject(prev => prev ? { ...prev, logo_url: null } : null);
      await load();
      toast({ title: 'Logo eliminado', description: 'Se ha eliminado el logo del proyecto' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar el logo', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!editingProject) return;

    try {
      const updates: any = {
        name: editForm.name.trim(),
        project_password: editForm.project_password.trim(),
        dailies_password: editForm.dailies_password.trim(),
        theme_color: editForm.theme_color,
      };

      if (editingProject.logo_url !== null) {
        updates.logo_url = editingProject.logo_url;
      }

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', editingProject.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Proyecto actualizado correctamente",
      });

      setEditOpen(false);
      setEditingProject(null);
      load();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el proyecto",
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const filtered = projects.filter(project =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.project_number.toString().includes(search) ||
    project.project_password.toLowerCase().includes(search.toLowerCase()) ||
    project.dailies_password.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProfiles = profiles.filter(profile => {
    const query = userSearch.toLowerCase();
    const profileUserId = profile.user_id || '';
    return (
      profile.full_name.toLowerCase().includes(query) ||
      (profile.email || '').toLowerCase().includes(query) ||
      profileUserId.toLowerCase().includes(query)
    );
  });

  const getUserProjectAccess = (userId: string) => {
    if (!userId) return [];
    return projectAccess.filter(access => access.user_id === userId);
  };

  const hasProjectAccess = (userId: string, projectId: string) => {
    if (!userId) return false;
    return projectAccess.some(access => access.user_id === userId && access.project_id === projectId);
  };

  const accessiblePeopleForSelectedUser = selectedProfile
    ? people.filter(person => {
        if (!selectedProfile.user_id) return false;
        if (linkedProjectId && person.project_id !== linkedProjectId) return false;
        const accessibleProjectIds = projectAccess
          .filter(access => access.user_id === selectedProfile.user_id)
          .map(access => access.project_id);
        return accessibleProjectIds.includes(person.project_id);
      })
    : [];

  const accessibleProjectsForSelectedUser = selectedProfile
    ? projects.filter(project =>
        projectAccess.some(access => access.user_id === selectedProfile.user_id && access.project_id === project.id)
      )
    : [];

  const updateLinkedPerson = async (personId: string) => {
    if (!selectedProfile?.user_id) {
      setLinkedPersonId(personId);
      return;
    }

    const accessibleProjectIds = projectAccess
      .filter(access => access.user_id === selectedProfile.user_id)
      .map(access => access.project_id);

    if (personId) {
      const selectedPerson = people.find(person => person.id === personId);
      if (!selectedPerson) return;
      setLinkedProjectId(selectedPerson.project_id);
      if (!accessibleProjectIds.includes(selectedPerson.project_id)) {
        toast({
          title: 'Acceso no permitido',
          description: 'Ese miembro pertenece a un proyecto al que el usuario no tiene acceso.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      if (personId) {
        const { error: unlinkError } = await supabase
          .from('people')
          .update({ user_id: null })
          .eq('user_id', selectedProfile.user_id)
          .neq('id', personId);

        if (unlinkError) throw unlinkError;

        const { error: linkError } = await supabase
          .from('people')
          .update({ user_id: selectedProfile.user_id })
          .eq('id', personId);

        if (linkError) throw linkError;
      } else {
        const { error: unlinkError } = await supabase
          .from('people')
          .update({ user_id: null })
          .eq('user_id', selectedProfile.user_id);

        if (unlinkError) throw unlinkError;
      }

      setLinkedPersonId(personId);
      setPeople(prev => prev.map(person => ({
        ...person,
        user_id: person.id === personId ? selectedProfile.user_id : (person.user_id === selectedProfile.user_id ? null : person.user_id)
      })));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo vincular el usuario con el equipo',
        variant: 'destructive',
      });
    }
  };

  const openUserDialog = (profile: AdminProfile) => {
    const linkedPerson = people.find(person => person.user_id === profile.user_id);
    const accessibleProjectIds = projects
      .filter(project => projectAccess.some(access => access.user_id === profile.user_id && access.project_id === project.id))
      .map(project => project.id);

    setSelectedProfile(profile);
    setUserForm({
      full_name: profile.full_name,
      email: profile.email || '',
      color: profile.color,
      is_active: profile.is_active,
    });
    setLinkedPersonId(linkedPerson?.id || '');
    setLinkedProjectId(linkedPerson?.project_id || accessibleProjectIds[0] || '');
    setUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedProfile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userForm.full_name.trim(),
          email: userForm.email.trim() || null,
          color: userForm.color,
          is_active: userForm.is_active,
        })
        .eq('id', selectedProfile.id);

      if (error) throw error;

      toast({ title: 'Usuario actualizado', description: 'Los datos del usuario se han guardado.' });
      await loadUsers();
      setUserDialogOpen(false);
      setSelectedProfile(null);
      setLinkedPersonId('');
      setLinkedProjectId('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el usuario', variant: 'destructive' });
    }
  };

  const handleToggleUserActive = async (profile: AdminProfile, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: isActive ? 'Usuario activado' : 'Usuario dado de baja',
        description: `${profile.full_name} se ha actualizado correctamente.`,
      });
      await loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el estado', variant: 'destructive' });
    }
  };

  const handleProjectAccessToggle = async (profile: AdminProfile, project: ProjectRow, checked: boolean) => {
    try {
      if (checked) {
        const { error: accessError } = await supabase
          .from('project_access')
          .upsert({
            user_id: profile.user_id,
            project_id: project.id,
            granted_by: user?.id || null,
          }, { onConflict: 'user_id,project_id' });

        if (accessError) throw accessError;

        const permissionRows = projectSections.map(section => ({
          user_id: profile.user_id,
          project_id: project.id,
          section,
          can_access: true,
        }));

        const { error: permissionsError } = await supabase
          .from('user_permissions')
          .upsert(permissionRows, { onConflict: 'user_id,project_id,section' });

        if (permissionsError) throw permissionsError;
      } else {
        const { error: permissionsError } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', profile.user_id)
          .eq('project_id', project.id);

        if (permissionsError) throw permissionsError;

        const { error: accessError } = await supabase
          .from('project_access')
          .delete()
          .eq('user_id', profile.user_id)
          .eq('project_id', project.id);

        if (accessError) throw accessError;
      }

      await loadUsers();
      toast({
        title: 'Accesos actualizados',
        description: `${profile.full_name} ${checked ? 'tiene acceso a' : 'ya no tiene acceso a'} ${project.name}.`,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el acceso', variant: 'destructive' });
    }
  };

  const grantProjectToAllActiveUsers = async (project: ProjectRow) => {
    const activeUsers = profiles.filter(profile => profile.is_active);
    if (activeUsers.length === 0) return;

    try {
      const accessRows = activeUsers.map(profile => ({
        user_id: profile.user_id,
        project_id: project.id,
        granted_by: user?.id || null,
      }));

      const { error: accessError } = await supabase
        .from('project_access')
        .upsert(accessRows, { onConflict: 'user_id,project_id' });

      if (accessError) throw accessError;

      const permissionRows = activeUsers.flatMap(profile =>
        projectSections.map(section => ({
          user_id: profile.user_id,
          project_id: project.id,
          section,
          can_access: true,
        }))
      );

      const { error: permissionsError } = await supabase
        .from('user_permissions')
        .upsert(permissionRows, { onConflict: 'user_id,project_id,section' });

      if (permissionsError) throw permissionsError;

      await loadUsers();
      toast({
        title: 'Acceso concedido',
        description: `Todos los usuarios activos tienen acceso a ${project.name}.`,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo conceder acceso masivo', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/')}
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="truncate text-lg font-bold md:text-2xl">Administración</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6 px-4">
        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="projects">Proyectos</TabsTrigger>
            <TabsTrigger value="users">Usuarios</TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Gestión de Proyectos</CardTitle>
                <CardDescription>
                  Administra todos los proyectos del sistema
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={load} disabled={loading} aria-label="Actualizar proyectos">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Actualizar</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Buscar proyectos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead className="min-w-[120px]">Contraseña Proyecto</TableHead>
                      <TableHead className="min-w-[120px]">Contraseña Dailies</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Logo</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Cargando proyectos...
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          {search ? 'No se encontraron proyectos que coincidan con la búsqueda' : 'No hay proyectos'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">#{project.project_number}</Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded block truncate max-w-[100px]">
                              {project.project_password}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded block truncate max-w-[100px]">
                              {project.dailies_password}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-6 h-6 rounded border border-border"
                                style={{ backgroundColor: project.theme_color }}
                              />
                              <code className="text-xs">{project.theme_color}</code>
                            </div>
                          </TableCell>
                          <TableCell>
                            {project.logo_url ? (
                              <img 
                                src={project.logo_url} 
                                alt="Logo" 
                                className="h-8 w-auto object-contain"
                              />
                            ) : (
                              <span className="text-muted-foreground text-sm">Sin logo</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(project.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(project)}
                                aria-label={`Editar ${project.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDelete(project.id, project.name)}
                                className="text-destructive hover:text-destructive"
                                aria-label={`Eliminar ${project.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>
                      Usuarios dados de alta, estado del perfil y accesos por proyecto
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {projects[0] && (
                      <Button
                        variant="outline"
                        onClick={() => grantProjectToAllActiveUsers(projects[0])}
                        disabled={usersLoading}
                        aria-label={`Dar ${projects[0].name} a todos`}
                      >
                        <UserCog className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Dar {projects[0].name} a todos</span>
                      </Button>
                    )}
                    <Button variant="outline" onClick={loadUsers} disabled={usersLoading} aria-label="Actualizar usuarios">
                      <RefreshCcw className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Actualizar</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    placeholder="Buscar por nombre, email o ID..."
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    className="max-w-sm"
                  />

                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acceso a proyectos</TableHead>
                          <TableHead>Fecha alta</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usersLoading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                              Cargando usuarios...
                            </TableCell>
                          </TableRow>
                        ) : filteredProfiles.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                              {userSearch ? 'No se encontraron usuarios' : 'No hay usuarios dados de alta'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProfiles.map(profile => {
                            const access = getUserProjectAccess(profile.user_id);
                            return (
                              <TableRow key={profile.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: profile.color }} />
                                    <div>
                                      <div className="font-medium">{profile.full_name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        ID: {profile.user_id ? `${profile.user_id.slice(0, 8)}...` : 'Sin ID'}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{profile.email || 'Sin email'}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={profile.is_active}
                                      onCheckedChange={(checked) => handleToggleUserActive(profile, checked)}
                                      disabled={profile.user_id === user?.id}
                                    />
                                    <Badge variant={profile.is_active ? 'default' : 'secondary'}>
                                      {profile.is_active ? 'Activo' : 'Baja'}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {access.length === 0 ? (
                                      <span className="text-sm text-muted-foreground">Sin proyectos</span>
                                    ) : (
                                      access.map(item => {
                                        const project = projects.find(candidate => candidate.id === item.project_id);
                                        return (
                                          <Badge key={item.id} variant="outline">
                                            {project?.name || 'Proyecto eliminado'}
                                          </Badge>
                                        );
                                      })
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(profile.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openUserDialog(profile)}
                                      title="Ver y editar perfil"
                                      aria-label={`Ver y editar ${profile.full_name}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleToggleUserActive(profile, false)}
                                      disabled={!profile.is_active || profile.user_id === user?.id}
                                      className="text-destructive hover:text-destructive"
                                      title="Dar de baja"
                                      aria-label={`Dar de baja a ${profile.full_name}`}
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Project Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Editar Proyecto</DialogTitle>
              <DialogDescription>
                Modifica la información del proyecto seleccionado
              </DialogDescription>
            </DialogHeader>
            
            {editingProject && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Nombre del proyecto</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Nombre del proyecto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-project-password">Contraseña del proyecto</Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit-project-password"
                        type={showPasswords.project ? "text" : "password"}
                        value={editForm.project_password}
                        onChange={(e) => setEditForm({ ...editForm, project_password: e.target.value })}
                        placeholder="Contraseña del proyecto"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => togglePasswordVisibility('project')}
                        aria-label={showPasswords.project ? 'Ocultar contraseña del proyecto' : 'Mostrar contraseña del proyecto'}
                      >
                        {showPasswords.project ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-dailies-password">Contraseña de dailies</Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit-dailies-password"
                        type={showPasswords.dailies ? "text" : "password"}
                        value={editForm.dailies_password}
                        onChange={(e) => setEditForm({ ...editForm, dailies_password: e.target.value })}
                        placeholder="Contraseña de dailies"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => togglePasswordVisibility('dailies')}
                        aria-label={showPasswords.dailies ? 'Ocultar contraseña de dailies' : 'Mostrar contraseña de dailies'}
                      >
                        {showPasswords.dailies ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <ColorPicker
                      label="Color de Interacción del Proyecto"
                      value={editForm.theme_color}
                      onChange={(color) => setEditForm({ ...editForm, theme_color: color })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este color se utilizará para los botones y elementos de interacción del proyecto
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Logo del proyecto</Label>
                    {editingProject.logo_url && (
                      <div className="flex items-center gap-4">
                        <img 
                          src={editingProject.logo_url} 
                          alt="Logo del proyecto"
                          className="h-16 w-auto object-contain border rounded"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleRemoveLogo}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        <span>{isUploading ? 'Subiendo...' : editingProject.logo_url ? 'Cambiar logo' : 'Subir logo'}</span>
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        JPG, PNG, GIF. Max 5MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={userDialogOpen} onOpenChange={(open) => {
          setUserDialogOpen(open);
          if (!open) {
            setSelectedProfile(null);
            setLinkedPersonId('');
            setLinkedProjectId('');
          }
        }}>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>Perfil de usuario</DialogTitle>
              <DialogDescription>
                Consulta, edita el perfil y gestiona los proyectos a los que puede acceder.
              </DialogDescription>
            </DialogHeader>

            {selectedProfile && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-user-name">Nombre completo</Label>
                    <Input
                      id="admin-user-name"
                      value={userForm.full_name}
                      onChange={(event) => setUserForm(prev => ({ ...prev, full_name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-user-email">Email</Label>
                    <Input
                      id="admin-user-email"
                      type="email"
                      value={userForm.email}
                      onChange={(event) => setUserForm(prev => ({ ...prev, email: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-user-color">Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="admin-user-color"
                        type="color"
                        value={userForm.color}
                        onChange={(event) => setUserForm(prev => ({ ...prev, color: event.target.value }))}
                        className="h-10 w-16"
                      />
                      <span className="text-sm text-muted-foreground">{userForm.color}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <div className="flex h-10 items-center gap-2">
                      <Switch
                        checked={userForm.is_active}
                        onCheckedChange={(checked) => setUserForm(prev => ({ ...prev, is_active: checked }))}
                        disabled={selectedProfile.user_id === user?.id}
                      />
                      <Badge variant={userForm.is_active ? 'default' : 'secondary'}>
                        {userForm.is_active ? 'Activo' : 'Baja'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Miembro del equipo</Label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="admin-user-project">Proyecto</Label>
                        <Select
                          value={linkedProjectId || 'none'}
                          onValueChange={(value) => {
                            const nextProjectId = value === 'none' ? '' : value;
                            setLinkedProjectId(nextProjectId);
                            setLinkedPersonId('');
                          }}
                        >
                          <SelectTrigger id="admin-user-project">
                            <SelectValue placeholder="Seleccionar proyecto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin proyecto</SelectItem>
                            {accessibleProjectsForSelectedUser.map(project => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-user-person">Miembro</Label>
                        <Select
                          value={linkedPersonId || 'none'}
                          onValueChange={(value) => updateLinkedPerson(value === 'none' ? '' : value)}
                          disabled={!linkedProjectId}
                        >
                          <SelectTrigger id="admin-user-person">
                            <SelectValue placeholder={linkedProjectId ? 'Seleccionar miembro' : 'Elige primero un proyecto'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin vincular</SelectItem>
                            {accessiblePeopleForSelectedUser.map(person => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold">Acceso a proyectos</h3>
                    <p className="text-sm text-muted-foreground">Marca los proyectos disponibles para este usuario.</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay proyectos disponibles.</p>
                    ) : (
                      projects.map(project => (
                        <label key={project.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{project.name}</div>
                            <div className="text-xs text-muted-foreground">Proyecto #{project.project_number}</div>
                          </div>
                          <Checkbox
                            checked={hasProjectAccess(selectedProfile.user_id, project.id)}
                            onCheckedChange={(checked) => handleProjectAccessToggle(selectedProfile, project, !!checked)}
                          />
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="font-semibold mb-2">Datos técnicos</h3>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">User ID: </span>
                      <code>{selectedProfile.user_id}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Alta: </span>
                      {new Date(selectedProfile.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <Button
                    variant="destructive"
                    onClick={() => handleToggleUserActive(selectedProfile, false)}
                    disabled={!selectedProfile.is_active || selectedProfile.user_id === user?.id}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Dar de baja
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                      Cerrar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminProjects;
