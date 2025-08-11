import { useState, useEffect } from 'react';
import { Plus, FileText, Search, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  project_id: string;
  content: string;
  title?: string;
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
}

interface NotesIndexProps {
  projectId: string;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
}

export default function NotesIndex({ projectId, onSelectNote, onCreateNote }: NotesIndexProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('shared_notes')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setNotes(data || []);
      setFilteredNotes(data || []);
    } catch (error: any) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las notas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredNotes(notes);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = notes.filter(note => 
      note.title?.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
    setFilteredNotes(filtered);
  }, [notes, searchQuery]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPreview = (content: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    return textContent.trim().substring(0, 150) + (textContent.length > 150 ? '...' : '');
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
            Gestiona y navega entre las notas del proyecto
          </p>
        </div>
        
        <Button onClick={onCreateNote}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva nota
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">
          {filteredNotes.length} nota{filteredNotes.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {filteredNotes.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No se encontraron notas' : 'No hay notas creadas'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'Intenta con otros términos de búsqueda' 
                : 'Crea tu primera nota compartida para comenzar'
              }
            </p>
            {!searchQuery && (
              <Button onClick={onCreateNote}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera nota
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <Card 
              key={note.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectNote(note)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg line-clamp-2">
                  {note.title || 'Sin título'}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(note.updated_at)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {getPreview(note.content)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}