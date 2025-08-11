import { useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProfiles, type Profile } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CryptoJS from 'crypto-js';

interface UsersModuleProps {
  projectId: string;
}

export default function UsersModule({ projectId }: UsersModuleProps) {
  const { profiles, loading, updateProfile, deleteProfile } = useProfiles();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    color: '#3B82F6',
    role: 'viewer' as 'admin' | 'manager' | 'viewer',
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    
    if (!editingProfile) {
      // Crear nuevo usuario
      const password = generateSecurePassword();
      setGeneratedPassword(password);
      
      try {
        const { error: signUpError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: formData.full_name,
          }
        });

        if (signUpError) throw signUpError;

        toast({
          title: "Usuario creado",
          description: `Usuario creado exitosamente. Contraseña generada.`,
        });
        
        setShowPassword(true);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      // Actualizar perfil existente
      await updateProfile(editingProfile.id, {
        full_name: formData.full_name,
        color: formData.color,
      });
      handleCloseDialog();
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setFormData({
      email: '',
      full_name: '',
      color: '#3B82F6',
      role: 'viewer',
    });
    setGeneratedPassword('');
    setShowPassword(false);
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      email: '',
      full_name: profile.full_name,
      color: profile.color,
      role: 'viewer',
    });
    setIsDialogOpen(true);
  };

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

  if (loading) {
    return <div className="p-6 text-center">Cargando usuarios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra los miembros del equipo</p>
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
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Select value={formData.role} onValueChange={(value: any) => setFormData(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin - Acceso completo</SelectItem>
                        <SelectItem value="manager">Manager - Gestión de proyecto</SelectItem>
                        <SelectItem value="viewer">Viewer - Solo lectura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingProfile ? 'Actualizar' : 'Crear usuario'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios del sistema</CardTitle>
          <CardDescription>
            Lista de todos los usuarios registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{profile.full_name}</div>
                      <div className="text-sm text-muted-foreground">ID: {profile.user_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border" 
                        style={{ backgroundColor: profile.color }}
                      />
                      <span className="text-sm">{profile.color}</span>
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
                  <TableCell>
                    {new Date(profile.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(profile)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegeneratePassword(profile.user_id)}
                        disabled={profile.user_id === currentUser?.id}
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}