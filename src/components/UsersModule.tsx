import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useProfiles, type Profile } from '@/hooks/useProfiles';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CryptoJS from 'crypto-js';

interface UsersModuleProps {
  projectId: string;
}

const sections = [
  { id: 'tasks', name: 'Tareas', description: 'Gestión de incidencias y tareas' },
  { id: 'dailies', name: 'Seguimiento diario', description: 'Seguimiento diario del proyecto' },
  { id: 'vacations', name: 'Vacaciones', description: 'Gestión de vacaciones del equipo' },
  { id: 'users', name: 'Usuarios', description: 'Gestión de miembros del equipo' },
  { id: 'notes', name: 'Notas', description: 'Notas compartidas del proyecto' },
  { id: 'settings', name: 'Configuración', description: 'Configuración del proyecto' },
];

export default function UsersModule({ projectId }: UsersModuleProps) {
  const { profiles, loading, updateProfile, deleteProfile, refetch: refetchProfiles } = useProfiles();
  const { permissions, updatePermission, hasPermission, refetch: refetchPermissions } = useUserPermissions(projectId);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    color: '#3B82F6',
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});

  const generateSecurePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProfile) return;
    
    if (!editingProfile) {
      // Crear nuevo usuario
      const password = generateSecurePassword();
      setGeneratedPassword(password);
      
      try {
        // Crear usuario usando signup regular
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: formData.full_name,
            }
          }
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          // Esperar un poco para que el trigger se ejecute
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Actualizar el perfil con los datos adicionales
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              full_name: formData.full_name,
              color: formData.color,
            })
            .eq('user_id', authData.user.id);

          if (updateError) {
            console.error('Error updating profile:', updateError);
          }

          // Crear acceso al proyecto
          const { error: accessError } = await supabase
            .from('project_access')
            .insert({
              user_id: authData.user.id,
              project_id: projectId,
              granted_by: currentUser?.id,
            });

          if (accessError) {
            console.error('Error creating project access:', accessError);
          }

          // Crear permisos por defecto para las secciones seleccionadas
          const permissionPromises = Object.entries(selectedPermissions)
            .filter(([_, isSelected]) => isSelected)
            .map(([section, _]) => 
              supabase.from('user_permissions').insert({
                user_id: authData.user.id,
                project_id: projectId,
                section,
                can_access: true,
              })
            );

          await Promise.all(permissionPromises);

          // Refrescar los datos para mostrar el nuevo usuario en la tabla
          await refetchProfiles();
          await refetchPermissions();
        }

        toast({
          title: "Usuario creado",
          description: `Usuario creado exitosamente. Contraseña generada.`,
        });
        
        setShowPassword(true);
      } catch (error: any) {
        console.error('Error creating user:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setFormData({
      email: '',
      full_name: '',
      color: '#3B82F6',
    });
    setGeneratedPassword('');
    setShowPassword(false);
    setSelectedPermissions({});
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      email: '',
      full_name: profile.full_name,
      color: profile.color,
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (!editingProfile || !isDialogOpen || !formData.full_name.trim()) return;

    const handler = setTimeout(async () => {
      await updateProfile(editingProfile.id, {
        full_name: formData.full_name,
        color: formData.color,
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [editingProfile?.id, isDialogOpen, formData.full_name, formData.color]);

  const handleToggleActive = async (profile: Profile) => {
    await updateProfile(profile.id, { is_active: !profile.is_active });
  };

  const handleRegeneratePassword = async (userId: string) => {
    const newPassword = generateSecurePassword();
    
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Contraseña regenerada",
        description: `Nueva contraseña: ${newPassword}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePermissionToggle = async (userId: string, section: string, checked: boolean) => {
    await updatePermission(userId, section, checked);
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando usuarios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra los miembros del equipo y sus permisos por sección</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? 'Editar usuario' : 'Crear nuevo usuario'}
              </DialogTitle>
              <DialogDescription>
                {editingProfile 
                  ? 'Actualiza la información del usuario'
                  : 'Se generará una contraseña automáticamente'}
              </DialogDescription>
            </DialogHeader>
            
            {showPassword && generatedPassword ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold text-success mb-2">¡Usuario creado exitosamente!</h3>
                  <div className="space-y-2">
                    <p><strong>Email:</strong> {formData.email}</p>
                    <p><strong>Nombre:</strong> {formData.full_name}</p>
                    <div className="flex items-center gap-2">
                      <strong>Contraseña:</strong>
                      <code className="bg-background px-2 py-1 rounded text-sm">
                        {generatedPassword}
                      </code>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Guarda esta contraseña de forma segura. El usuario deberá cambiarla en su primer acceso.
                  </p>
                </div>
                <Button onClick={handleCloseDialog} className="w-full">
                  Cerrar
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingProfile && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="full_name">Nombre completo</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-16 h-10"
                    />
                    <span className="text-sm text-muted-foreground">
                      Color para identificar al usuario en calendarios y gráficos
                    </span>
                  </div>
                </div>

                {!editingProfile && (
                  <div className="space-y-3">
                    <Label>Permisos de sección</Label>
                    <p className="text-sm text-muted-foreground">
                      Selecciona las secciones a las que tendrá acceso este usuario
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {sections.map((section) => (
                        <div key={section.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`permission-${section.id}`}
                            checked={selectedPermissions[section.id] || false}
                            onCheckedChange={(checked) => 
                              setSelectedPermissions(prev => ({
                                ...prev,
                                [section.id]: !!checked
                              }))
                            }
                          />
                          <Label 
                            htmlFor={`permission-${section.id}`}
                            className="text-sm font-normal"
                          >
                            {section.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    {editingProfile ? 'Cerrar' : 'Cancelar'}
                  </Button>
                  {!editingProfile && (
                    <Button type="submit">
                      Crear usuario
                    </Button>
                  )}
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios y Permisos por Sección</CardTitle>
          <CardDescription>
            Gestiona qué secciones puede ver y editar cada usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  {sections.map((section) => (
                    <TableHead key={section.id} className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{section.name}</span>
                        <span className="text-xs text-muted-foreground">{section.description}</span>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full border" 
                          style={{ backgroundColor: profile.color }}
                        />
                        <div>
                          <div className="font-medium">{profile.full_name}</div>
                          <div className="text-sm text-muted-foreground">ID: {profile.user_id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={profile.is_active}
                          onCheckedChange={() => handleToggleActive(profile)}
                          disabled={profile.user_id === currentUser?.id}
                        />
                        <Badge variant={profile.is_active ? "default" : "secondary"}>
                          {profile.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </TableCell>
                    {sections.map((section) => (
                      <TableCell key={section.id} className="text-center">
                        <Checkbox
                          checked={hasPermission(profile.user_id, section.id)}
                          onCheckedChange={(checked) => 
                            handlePermissionToggle(profile.user_id, section.id, !!checked)
                          }
                          disabled={profile.user_id === currentUser?.id}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(profile)}
                          title="Editar perfil"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegeneratePassword(profile.user_id)}
                          disabled={profile.user_id === currentUser?.id}
                          title="Regenerar contraseña"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
                              deleteProfile(profile.id);
                            }
                          }}
                          disabled={profile.user_id === currentUser?.id}
                          title="Eliminar usuario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Instrucciones:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Marca las casillas para permitir acceso a cada sección</li>
              <li>• Si una sección no está marcada, no aparecerá en el menú del usuario</li>
              <li>• Los usuarios pueden ver y editar el contenido de las secciones marcadas</li>
              <li>• No puedes modificar tus propios permisos</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
