import { useState, useEffect, useRef } from 'react';
import { Save, History, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useSharedNotes } from '@/hooks/useSharedNotes';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface NotesModuleProps {
  projectId: string;
}

export default function NotesModule({ projectId }: NotesModuleProps) {
  const { note, history, loading, createOrUpdateNote } = useSharedNotes(projectId);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Configuración del editor
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'blockquote', 'code-block'],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
  };

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent', 'link', 'blockquote', 
    'code-block', 'color', 'background'
  ];

  // Cargar contenido inicial
  useEffect(() => {
    if (note) {
      setContent(note.content);
      setHasChanges(false);
    }
  }, [note]);

  // Auto-guardado
  useEffect(() => {
    if (hasChanges && content !== (note?.content || '')) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave();
      }, 2000); // Auto-guardar después de 2 segundos de inactividad
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, hasChanges, note]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    
    setIsSaving(true);
    try {
      await createOrUpdateNote(content, user?.id);
      setHasChanges(false);
      toast({
        title: "Guardado",
        description: "Las notas se han guardado correctamente",
      });
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando notas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notas Compartidas</h1>
          <p className="text-muted-foreground">
            Área colaborativa para notas y documentación del proyecto
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary">
              Cambios sin guardar
            </Badge>
          )}
          
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            variant={hasChanges ? "default" : "outline"}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
          
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <History className="h-4 w-4 mr-2" />
                Historial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Historial de cambios</DialogTitle>
                <DialogDescription>
                  Versiones anteriores de las notas
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay historial de cambios disponible
                  </p>
                ) : (
                  history.map((entry) => (
                    <Card key={entry.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Editado el {formatDate(entry.created_at)}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setContent(entry.content);
                              setHasChanges(true);
                              setHistoryOpen(false);
                            }}
                          >
                            Restaurar versión
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose max-w-none"
                          dangerouslySetInnerHTML={{ __html: entry.content }}
                        />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="min-h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              Documento del proyecto
              {note?.last_edited_by && (
                <Badge variant="outline" className="text-xs">
                  Última edición: {formatDate(note.updated_at)}
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Editor colaborativo con guardado automático cada 2 segundos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[500px]">
            <ReactQuill
              theme="snow"
              value={content}
              onChange={handleContentChange}
              modules={modules}
              formats={formats}
              placeholder="Escribe aquí las notas del proyecto..."
              style={{ height: '450px' }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Consejos:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Los cambios se guardan automáticamente cada 2 segundos</li>
          <li>Puedes ver y restaurar versiones anteriores en el historial</li>
          <li>Todos los usuarios con acceso al proyecto pueden editar estas notas</li>
          <li>Usa el botón "Guardar" para forzar el guardado inmediato</li>
        </ul>
      </div>
    </div>
  );
}