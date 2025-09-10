import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Trash2, Upload, Save, RefreshCcw, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const AdminProjects = () => {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [search, setSearch] = useState('');
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
  const navigate = useNavigate();

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

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <h1 className="text-2xl font-bold">Administración de Proyectos</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6 px-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Gestión de Proyectos</CardTitle>
                <CardDescription>
                  Administra todos los proyectos del sistema
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={load} disabled={loading}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Actualizar
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
                <Table>
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
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDelete(project.id, project.name)}
                                className="text-destructive hover:text-destructive"
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
                          Eliminar
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
                        {isUploading ? 'Subiendo...' : editingProject.logo_url ? 'Cambiar logo' : 'Subir logo'}
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        JPG, PNG, GIF. Max 5MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </Button>
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