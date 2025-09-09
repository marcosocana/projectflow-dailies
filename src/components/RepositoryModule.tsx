import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, Upload, FileText, Lock, Unlock } from 'lucide-react';
import { useRepositoryFiles, type RepositoryFile } from '@/hooks/useRepositoryFiles';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepositoryModuleProps {
  projectId: string;
}

const RepositoryModule = ({ projectId }: RepositoryModuleProps) => {
  const { files, loading, uploadFile, downloadFile, deleteFile } = useRepositoryFiles(projectId);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<RepositoryFile | null>(null);
  const [uploadForm, setUploadForm] = useState({
    password: '',
    description: ''
  });
  const [downloadPassword, setDownloadPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileToUpload, setSelectedFileToUpload] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileToUpload(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileToUpload) return;
    
    await uploadFile(
      selectedFileToUpload,
      projectId,
      uploadForm.password || undefined,
      uploadForm.description || undefined
    );
    
    setUploadForm({ password: '', description: '' });
    setSelectedFileToUpload(null);
    setUploadDialogOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadRequest = (file: RepositoryFile) => {
    if (file.password_required) {
      setSelectedFile(file);
      setDownloadDialogOpen(true);
    } else {
      downloadFile(file);
    }
  };

  const handleDownloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    
    await downloadFile(selectedFile, downloadPassword);
    setDownloadPassword('');
    setSelectedFile(null);
    setDownloadDialogOpen(false);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Desconocido';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Repositorio</h1>
          <p className="text-muted-foreground">Gestión de archivos del proyecto con protección por contraseña</p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Subir archivo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Subir nuevo archivo</DialogTitle>
              <DialogDescription>Selecciona un archivo y configura las opciones de seguridad</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">Archivo *</Label>
                <Input
                  id="file-upload"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  required
                />
                {selectedFileToUpload && (
                  <p className="text-sm text-muted-foreground">
                    Seleccionado: {selectedFileToUpload.name} ({formatFileSize(selectedFileToUpload.size)})
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-password">Contraseña (opcional)</Label>
                <Input
                  id="upload-password"
                  type="password"
                  value={uploadForm.password}
                  onChange={(e) => setUploadForm({ ...uploadForm, password: e.target.value })}
                  placeholder="Contraseña para proteger el archivo"
                />
                <p className="text-xs text-muted-foreground">
                  Si estableces una contraseña, será necesaria para descargar el archivo
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-description">Descripción</Label>
                <Textarea
                  id="upload-description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Descripción del archivo"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!selectedFileToUpload}>
                  Subir archivo
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay archivos en el repositorio</p>
            <p className="text-sm text-muted-foreground mt-1">Sube el primer archivo para empezar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {files.map((file) => (
            <Card key={file.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{file.name}</CardTitle>
                      {file.password_required ? (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Protegido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Unlock className="h-3 w-3 mr-1" />
                          Público
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Tamaño: {formatFileSize(file.file_size)}</span>
                      <span>
                        Subido {formatDistanceToNow(new Date(file.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
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
                      onClick={() => deleteFile(file)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {file.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{file.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Download Password Dialog */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archivo protegido</DialogTitle>
            <DialogDescription>
              Este archivo está protegido con contraseña. Introduce la contraseña para descargarlo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDownloadSubmit} className="space-y-4">
            <div className="space-y-2">
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDownloadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Descargar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepositoryModule;