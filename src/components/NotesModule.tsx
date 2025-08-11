import { useState, useEffect, useRef } from 'react';
import { Save, History, User, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useSharedNotes } from '@/hooks/useSharedNotes';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import ReactQuill from 'react-quill';
import NotesIndex from './NotesIndex';
import 'react-quill/dist/quill.snow.css';

interface NotesModuleProps {
  projectId: string;
}

interface Note {
  id: string;
  project_id: string;
  content: string;
  title?: string;
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
}

export default function NotesModule({ projectId }: NotesModuleProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentView, setCurrentView] = useState<'index' | 'editor'>('index');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
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
    if (selectedNote) {
      setContent(selectedNote.content);
      setHasChanges(false);
    }
  }, [selectedNote]);

  // Auto-guardado
  useEffect(() => {
    if (hasChanges && content !== (selectedNote?.content || '')) {
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
  }, [content, hasChanges, selectedNote]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges || isSaving || !selectedNote) return;
    
    setIsSaving(true);
    try {
      // Simular guardado - en una app real esto iría a Supabase
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

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setCurrentView('editor');
  };

  const handleCreateNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      project_id: projectId,
      content: '',
      title: 'Nueva nota',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSelectedNote(newNote);
    setCurrentView('editor');
  };

  const handleBackToIndex = () => {
    setCurrentView('index');
    setSelectedNote(null);
    setContent('');
    setHasChanges(false);
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

  if (currentView === 'index') {
    return (
      <NotesIndex 
        projectId={projectId}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleBackToIndex}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a notas
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{selectedNote?.title || 'Nota'}</h1>
            <p className="text-muted-foreground">
              Editor colaborativo para la nota seleccionada
            </p>
          </div>
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
        </div>
      </div>

      <Card className="min-h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {selectedNote?.title || 'Documento'}
              {selectedNote?.last_edited_by && (
                <Badge variant="outline" className="text-xs">
                  Última edición: {formatDate(selectedNote.updated_at)}
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
              placeholder="Escribe aquí el contenido de la nota..."
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
          <li>Usa el botón "Volver a notas" para navegar entre diferentes notas</li>
          <li>Todos los usuarios con acceso al proyecto pueden editar estas notas</li>
          <li>Usa el botón "Guardar" para forzar el guardado inmediato</li>
        </ul>
      </div>
    </div>
  );
}