import { useState, useRef, useEffect } from 'react';
import { Save, Upload, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProjectSettingsModuleProps {
  projectId: string;
}

export default function ProjectSettingsModule({ projectId }: ProjectSettingsModuleProps) {
  const { currentProject } = useProjectAccess();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load current project data
  useEffect(() => {
    if (currentProject) {
      setFormData({
        name: currentProject.name || '',
      });
    }
  }, [currentProject]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen no puede superar los 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('project-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-logos')
        .getPublicUrl(fileName);

      // Actualizar el proyecto con la nueva URL del logo
      const { error: updateError } = await supabase
        .from('projects')
        .update({ logo_url: publicUrl })
        .eq('id', projectId);

      if (updateError) throw updateError;

      toast({
        title: "Éxito",
        description: "Logo actualizado correctamente",
      });

      // Recargar la página para ver el nuevo logo
      window.location.reload();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al subir el logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentProject?.logo_url) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ logo_url: null })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Logo eliminado correctamente",
      });

      // Recargar la página
      window.location.reload();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el logo",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: any = {};
      
      if (formData.name.trim() && formData.name !== currentProject?.name) {
        updates.name = formData.name.trim();
      }

      if (Object.keys(updates).length === 0) {
        toast({
          title: "Sin cambios",
          description: "No hay cambios para guardar",
        });
        return;
      }

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Configuración del proyecto actualizada",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la configuración",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración del Proyecto</CardTitle>
          <CardDescription>
            Gestiona la información básica del proyecto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Información básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información básica</h3>
            
            <div className="space-y-2">
              <Label htmlFor="project-name">Nombre del proyecto</Label>
              <Input
                id="project-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nombre del proyecto"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Número del proyecto</Label>
              <Input
                value={currentProject?.project_number || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                El número del proyecto se asigna automáticamente y no puede modificarse
              </p>
            </div>
          </div>

          {/* Logo del proyecto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Logo del proyecto</h3>
            
            {currentProject?.logo_url && (
              <div className="flex items-center gap-4">
                <img 
                  src={currentProject.logo_url} 
                  alt="Logo del proyecto"
                  className="h-16 w-auto object-contain border rounded"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRemoveLogo}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar logo
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Subiendo...' : currentProject?.logo_url ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Formatos: JPG, PNG, GIF. Tamaño máximo: 5MB
              </p>
            </div>
          </div>

          {/* Información adicional */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información adicional</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de versión</Label>
                <Input
                  value="V.1.0.0"
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Última actualización</Label>
                <Input
                  value={currentProject?.updated_at ? new Date(currentProject.updated_at).toLocaleDateString() : ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Botón de guardar */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}