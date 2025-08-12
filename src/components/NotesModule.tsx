import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSharedNotes } from '@/hooks/useSharedNotes';
import { useProfiles } from '@/hooks/useProfiles';
import { Plus, FileText, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
interface NotesModuleProps {
  projectId: string;
}

export default function NotesModule({ projectId }: NotesModuleProps) {
  const { notes, loading } = useSharedNotes(projectId);
  const navigate = useNavigate();
  const { profiles } = useProfiles();
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
    document.title = 'Notas Compartidas';
  }, []);

const openCreate = () => {
  navigate('/notes/new');
};

const openEditDialog = (note: any) => {
  navigate(`/notes/${note.id}`);
};

const authorName = (note: any) => {
  const p = profiles.find(p => p.user_id === note.last_edited_by);
  return p?.full_name || 'Usuario';
};

const formatDate = (iso: string) => format(new Date(iso), 'dd/MM/yyyy');

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
      <Button onClick={openCreate} aria-label="Crear nueva nota">
        <Plus className="h-4 w-4 mr-2" />
        Nueva Nota
      </Button>
    </div>
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar notas..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-10"
      />
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

}