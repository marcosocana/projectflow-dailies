import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSharedNotes } from '@/hooks/useSharedNotes';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface NoteCreateProps {
  projectId: string;
}

export default function NoteCreate({ projectId }: NoteCreateProps) {
  const navigate = useNavigate();
  const { createNote, updateNote } = useSharedNotes(projectId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Nueva nota';
  }, []);

  const isDirty = useMemo(() => title.trim() !== '' || content.trim() !== '', [title, content]);

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    const newNote = await createNote(title.trim() || 'Sin título');
    if (newNote) {
      await updateNote(newNote.id, content, title.trim() || 'Sin título');
      navigate(`/notes/${newNote.id}`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nueva nota</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/notes')}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? 'Creando...' : 'Crear nota'}
          </Button>
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
    </div>
  );
}
