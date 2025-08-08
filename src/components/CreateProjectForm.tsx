import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, X } from 'lucide-react';

interface CreateProjectFormProps {
  onProjectCreated: (projectId: string, projectNumber: number) => void;
  onClose: () => void;
}

const CreateProjectForm = ({ onProjectCreated, onClose }: CreateProjectFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    projectPassword: '',
    dailiesPassword: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  // Resize image to fit within 160x40 while preserving aspect ratio
  const resizeImage = async (file: File, maxW = 160, maxH = 40): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No 2D context'));
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('No se pudo procesar la imagen'));
        }, 'image/png', 0.92);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsCreating(true);
    try {
      let logoUrl: string | null = null;

      // Upload logo if provided
      if (logoFile) {
        const resized = await resizeImage(logoFile, 160, 40);
        const fileName = `${crypto.randomUUID()}.png`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project-logos')
          .upload(filePath, resized, { contentType: 'image/png' });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL from public bucket
        const { data: { publicUrl } } = supabase.storage
          .from('project-logos')
          .getPublicUrl(filePath);
        logoUrl = publicUrl;
      }

      // Create project
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          project_password: formData.projectPassword,
          dailies_password: formData.dailiesPassword,
          logo_url: logoUrl,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Proyecto creado",
        description: `Proyecto "${formData.name}" creado con número ${project.project_number}`,
      });

      onProjectCreated(project.id, project.project_number);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el proyecto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Crear Nuevo Proyecto
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Define los datos del proyecto y las contraseñas de acceso
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Nombre del Proyecto</Label>
            <Input
              id="project-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ej: Aplicación Mobile v2.0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-password">Contraseña General</Label>
            <Input
              id="project-password"
              type="password"
              value={formData.projectPassword}
              onChange={(e) => handleInputChange('projectPassword', e.target.value)}
              placeholder="Contraseña para acceder al proyecto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dailies-password">Contraseña de Gestión de Dailies</Label>
            <Input
              id="dailies-password"
              type="password"
              value={formData.dailiesPassword}
              onChange={(e) => handleInputChange('dailiesPassword', e.target.value)}
              placeholder="Contraseña especial para gestión diaria"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-upload">Logo del Proyecto (Opcional)</Label>
            {logoPreview ? (
              <div className="flex items-center gap-4">
                <img 
                  src={logoPreview} 
                  alt="Logo preview" 
                  className="h-16 w-16 object-contain border border-border rounded"
                />
                <Button type="button" variant="outline" size="sm" onClick={removeLogo}>
                  <X className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Arrastra una imagen o haz clic para seleccionar
                </p>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => document.getElementById('logo-upload')?.click()}
                >
                  Seleccionar Archivo
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isCreating} className="flex-1">
              {isCreating ? 'Creando...' : 'Crear Proyecto'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateProjectForm;