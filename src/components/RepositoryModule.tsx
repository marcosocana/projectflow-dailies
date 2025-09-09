import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Download, Trash2, FileText, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface RepositoryModuleProps {
  projectId: string;
}

interface RepositoryFile {
  id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  password_required: boolean;
  description: string | null;
  created_at: string;
}

export default function RepositoryModule({ projectId }: RepositoryModuleProps) {
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<RepositoryFile | null>(null);
  const [downloadPassword, setDownloadPassword] = useState('');
  const { toast } = useToast();

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('repository_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los archivos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
    if (file) {
      setUploadName(file.name);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Desconocido';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !uploadName.trim()) {
      toast({
        title: "Error",
        description: "El archivo y el nombre son obligatorios",
        variant: "destructive",
      });
      return;
    }

    try {
      // Upload to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Hash password if provided
      let passwordHash = null;
      if (isPasswordRequired && password) {
        passwordHash = btoa(password);
      }

      // Store file metadata in database
      const { error: dbError } = await supabase
        .from('repository_files')
        .insert({
          project_id: projectId,
          name: uploadName.trim(),
          file_path: filePath,
          file_size: selectedFile.size,
          content_type: selectedFile.type,
          description: description.trim() || null,
          password_required: isPasswordRequired,
          password_hash: passwordHash,
        });

      if (dbError) throw dbError;
      
      await loadFiles();
      setIsDialogOpen(false);
      setSelectedFile(null);
      setUploadName('');
      setDescription('');
      setPassword('');
      setIsPasswordRequired(false);
      
      toast({
        title: "Éxito",
        description: "Archivo subido correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadRequest = (file: RepositoryFile) => {
    if (file.password_required) {
      setDownloadingFile(file);
      setIsDownloadDialogOpen(true);
    } else {
      handleDownload(file);
    }
  };

  const handleDownload = async (file: RepositoryFile, password?: string) => {
    try {
      // Check password if required
      if (file.password_required && password) {
        const passwordHash = btoa(password);
        const { data: fileData, error: fileError } = await supabase
          .from('repository_files')
          .select('password_hash')
          .eq('id', file.id)
          .single();

        if (fileError) throw fileError;
        if (fileData.password_hash !== passwordHash) {
          throw new Error('Contraseña incorrecta');
        }
      }

      // Download file
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Éxito",
        description: "Archivo descargado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadingFile) return;
    
    await handleDownload(downloadingFile, downloadPassword);
    setIsDownloadDialogOpen(false);
    setDownloadingFile(null);
    setDownloadPassword('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) {
      return;
    }

    try {
      const file = files.find(f => f.id === id);
      if (!file) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error } = await supabase
        .from('repository_files')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadFiles();
      toast({
        title: "Éxito",
        description: "Archivo eliminado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Repositorio</CardTitle>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Subir archivo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p>No hay archivos registrados aún</p>
              <p className="text-sm text-muted-foreground mt-1">Sube el primer archivo para empezar</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((file) => (
                <Card key={file.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg truncate mr-2">
                        {file.name}
                      </CardTitle>
                      <div className="flex gap-1 ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadRequest(file)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(file.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      {file.password_required && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Protegido
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">{formatFileSize(file.file_size || 0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Subido {format(new Date(file.created_at), 'dd/MM/yyyy')}
                    </p>
                    {file.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {file.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Subir archivo</DialogTitle>
            <DialogDescription>
              Sube un nuevo archivo al repositorio del proyecto
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleUploadSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="file">Archivo</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileSelect}
                required
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Archivo seleccionado: {selectedFile.name}
                </p>
              )}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Nombre del archivo"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el contenido del archivo..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="password-required"
                checked={isPasswordRequired}
                onChange={(e) => setIsPasswordRequired(e.target.checked)}
              />
              <Label htmlFor="password-required">Proteger con contraseña</Label>
            </div>

            {isPasswordRequired && (
              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña para proteger el archivo"
                  required={isPasswordRequired}
                />
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={!selectedFile || !uploadName.trim()}>
              Subir archivo
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Download Password Dialog */}
      <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Archivo protegido</DialogTitle>
            <DialogDescription>
              Este archivo está protegido con contraseña
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleDownloadSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="download-password">Contraseña</Label>
              <Input
                id="download-password"
                type="password"
                value={downloadPassword}
                onChange={(e) => setDownloadPassword(e.target.value)}
                placeholder="Introduce la contraseña"
                required
              />
            </div>
            
            <Button type="submit" className="w-full">
              Descargar archivo
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}