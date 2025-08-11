import { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSharedNotes, SharedNote } from '@/hooks/useSharedNotes';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save, FileText, Edit2, Trash2 } from 'lucide-react';
import NotesIndex from '@/components/NotesIndex';

interface NotesModuleProps {
  projectId: string;
}

export default function NotesModule({ projectId }: NotesModuleProps) {
  const { notes, loading, createNote, updateNote, deleteNote } = useSharedNotes(projectId);
  const { user } = useAuth();
  const [selectedNote, setSelectedNote] = useState<SharedNote | null>(null);
  const [content, setContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync content when note is selected
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.content);
      setNoteTitle(selectedNote.title);
      setHasChanges(false);
    }
  }, [selectedNote]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleTitleChange = (newTitle: string) => {
    setNoteTitle(newTitle);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedNote) return;
    
    // Actualizar el contenido con el título
    const updatedContent = content.replace(/<h1>.*?<\/h1>/, `<h1>${noteTitle}</h1>`);
    await updateNote(selectedNote.id, updatedContent, noteTitle);
    setHasChanges(false);
    setIsEditingTitle(false);
  };

  const handleCreateNote = async () => {
    const newNote = await createNote('Nueva nota');
    if (newNote) {
      setSelectedNote(newNote);
    }
  };

  const handleSelectNote = (note: any) => {
    setSelectedNote(note);
  };

  const handleBackToIndex = () => {
    setSelectedNote(null);
    setContent('');
    setNoteTitle('');
    setHasChanges(false);
    setIsEditingTitle(false);
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    
    if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      await deleteNote(selectedNote.id);
      handleBackToIndex();
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando notas...</div>;
  }

  // Mostrar índice si no hay nota seleccionada
  if (!selectedNote) {
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
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al índice
          </Button>
          
          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={noteTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="text-2xl font-bold border-0 px-0 focus-visible:ring-0"
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{noteTitle}</h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="destructive"
            size="sm"
            onClick={handleDeleteNote}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="min-h-[500px]">
            <ReactQuill
              theme="snow"
              value={content}
              onChange={handleContentChange}
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                  ['blockquote', 'code-block'],
                  ['link'],
                  ['clean']
                ],
              }}
              placeholder="Escribe el contenido de la nota..."
              style={{ border: 'none' }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}