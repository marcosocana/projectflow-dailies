import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useSharedNotes } from '@/hooks/useSharedNotes';
import { Plus, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNavigate } from 'react-router-dom';
interface NotesModuleProps {
  projectId: string;
}

export default function NotesModule({ projectId }: NotesModuleProps) {
  const { notes, loading, createNote, updateNote, deleteNote } = useSharedNotes(projectId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [noteForm, setNoteForm] = useState({ title: '', content: '' });
  const navigate = useNavigate();
  const hiddenIds: string[] = (() => {
    try { return JSON.parse(localStorage.getItem(`hidden_notes_${projectId}`) || '[]'); } catch { return []; }
  })();
  const visibleNotes = notes.filter((n: any) => !hiddenIds.includes(n.id));
  useEffect(() => {
    document.title = 'Notas Compartidas';
  }, []);

  const handleCreateNote = async () => {
    if (!noteForm.title.trim()) return;
    
    const newNote = await createNote(noteForm.title);
    if (newNote) {
      await updateNote(newNote.id, noteForm.content, noteForm.title);
      setNoteForm({ title: '', content: '' });
      setIsCreateOpen(false);
    }
  };

  const handleEditNote = async () => {
    if (!selectedNote || !noteForm.title.trim()) return;
    
    await updateNote(selectedNote.id, noteForm.content, noteForm.title);
    setIsEditOpen(false);
    setSelectedNote(null);
    setNoteForm({ title: '', content: '' });
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    
    await deleteNote(selectedNote.id);
    setIsDeleteOpen(false);
    setSelectedNote(null);
  };

  const openCreateDialog = () => {
    setNoteForm({ title: '', content: '' });
    setIsCreateOpen(true);
  };

  const openEditDialog = (note: any) => {
    navigate(`/notes/${note.id}`);
  };

  const openDeleteDialog = (note: any) => {
    setSelectedNote(note);
    setIsDeleteOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notas Compartidas</h1>
        <Button onClick={openCreateDialog} aria-label="Crear nueva nota">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Nota
        </Button>
      </div>

      {visibleNotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay notas aún</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera nota compartida</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primera nota
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleNotes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2 flex-1 mr-2">
                    {note.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent onClick={() => openEditDialog(note)} className="cursor-pointer">
                <div 
                  className="text-sm text-muted-foreground line-clamp-4 mb-3"
                  dangerouslySetInnerHTML={{ 
                    __html: note.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...'
                  }}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(note.updated_at), { 
                      addSuffix: true, 
                      locale: es 
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para crear nota */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Nota</DialogTitle>
            <DialogDescription>
              Crea una nueva nota compartida para el proyecto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={noteForm.title}
                onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título de la nota..."
                className="mt-1"
                aria-label="Título de la nota"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contenido</label>
              <div className="mt-1 border rounded-md">
                <ReactQuill
                  theme="snow"
                  value={noteForm.content}
                  onChange={(value) => setNoteForm(prev => ({ ...prev, content: value }))}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateNote}>
              Crear Nota
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}