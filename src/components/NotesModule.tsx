import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSharedNotes } from '@/hooks/useSharedNotes';
import { useProfiles } from '@/hooks/useProfiles';
import { Plus, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface NotesModuleProps {
  projectId: string;
}

export default function NotesModule({ projectId }: NotesModuleProps) {
  const { notes, loading } = useSharedNotes(projectId);
  const { profiles } = useProfiles();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const hiddenIds: string[] = (() => {
    try { return JSON.parse(localStorage.getItem(`hidden_notes_${projectId}`) || '[]'); } catch { return []; }
  })();

  const visibleNotes = useMemo(() => notes.filter((n: any) => !hiddenIds.includes(n.id)), [notes, hiddenIds]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleNotes;
    const strip = (html: string) => html.replace(/<[^>]*>/g, ' ');
    return visibleNotes.filter((n: any) =>
      (n.title || '').toLowerCase().includes(q) ||
      strip(n.content).toLowerCase().includes(q)
    );
  }, [visibleNotes, searchQuery]);

  useEffect(() => {
    document.title = 'Wikis colaborativas';
  }, []);

  const openCreate = () => navigate('/notes/new');
  const openDetail = (note: any) => navigate(`/notes/${note.id}`);

  const authorLabel = (note: any) => {
    const p = profiles.find(p => p.user_id === note.last_edited_by);
    return p?.full_name || 'Usuario'; // Por defecto es el email en alta
  };
  const dateLabel = (iso: string) => format(new Date(iso), 'dd/MM/yyyy');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Wikis colaborativas</CardTitle>
            <Button onClick={openCreate} aria-label="Crear nueva nota">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Nota
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Buscar notas"
            />
          </div>

          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay notas aún</h3>
              <p className="text-muted-foreground mb-4">Crea tu primera nota compartida</p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera nota
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note: any) => {
                const previewText = note.content.replace(/<[^>]*>/g, ' ').trim();
                const preview = previewText.substring(0, 150) + (previewText.length > 150 ? '...' : '');
                return (
                  <Card key={note.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(note)}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg line-clamp-2">
                        {note.title || 'Sin título'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-4 mb-3">{preview}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{authorLabel(note)}</span>
                        <span>{dateLabel(note.created_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
