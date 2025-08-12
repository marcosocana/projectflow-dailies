import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useSharedNotes } from '@/hooks/useSharedNotes';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface NoteDetailProps {
  projectId: string;
}

export default function NoteDetail({ projectId }: NoteDetailProps) {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { notes, updateNote, refetch } = useSharedNotes(projectId);

  const note = useMemo(() => notes.find(n => n.id === noteId), [notes, noteId]);

const [title, setTitle] = useState('');
const [content, setContent] = useState('');
const [originalTitle, setOriginalTitle] = useState('');
const [originalContent, setOriginalContent] = useState('');
const [saving, setSaving] = useState(false);
const [isDeleteOpen, setIsDeleteOpen] = useState(false);
const isDirty = useMemo(() => title !== originalTitle || content !== originalContent, [title, content, originalTitle, originalContent]);

  useEffect(() => {
    if (!note) refetch();
  }, [note, refetch]);

useEffect(() => {
  if (note) {
    setTitle(note.title);
    setContent(note.content);
    setOriginalTitle(note.title);
    setOriginalContent(note.content);
    document.title = `Nota: ${note.title}`;
  }
}, [note]);

const handleSave = async () => {
  if (!noteId || !isDirty) return;
  setSaving(true);
  await updateNote(noteId, content, title || 'Sin título');
  setOriginalTitle(title || 'Sin título');
  setOriginalContent(content);
  setSaving(false);
};

  const handleDeleteSoft = () => {
    if (!noteId) return;
    const key = `hidden_notes_${projectId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    if (!current.includes(noteId)) current.push(noteId);
    localStorage.setItem(key, JSON.stringify(current));
    navigate('/notes');
  };

  if (!note) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando nota…</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Detalle de nota</h1>
        <div className="flex gap-2">
<Button variant="secondary" onClick={() => setIsDeleteOpen(true)}>Eliminar</Button>
<Button onClick={handleSave} disabled={!isDirty || saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Título</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la nota" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contenido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <ReactQuill theme="snow" value={content} onChange={setContent} />
          </div>
</CardContent>
      </Card>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción ocultará la nota de la lista, pero seguirá existiendo en la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSoft}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
