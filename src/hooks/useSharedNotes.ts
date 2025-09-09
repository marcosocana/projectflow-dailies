import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface SharedNote {
  id: string;
  project_id: string;
  content: string;
  title: string;
  last_edited_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SharedNoteHistory {
  id: string;
  note_id: string;
  content: string;
  edited_by?: string;
  created_at: string;
}

export function useSharedNotes(projectId?: string) {
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchNotes = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('shared_notes')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setNotes((data || []) as any);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createNote = async (title: string = 'Nueva nota') => {
    if (!projectId || !user) return null;
    
    try {
      // Verificar si ya existe una nota con el mismo título
      let finalTitle = title;
      let counter = 1;
      let titleExists = true;
      
      while (titleExists) {
        const existingNote = notes.find(note => note.title === finalTitle);
        if (!existingNote) {
          titleExists = false;
        } else {
          finalTitle = `${title} (${counter})`;
          counter++;
        }
      }
      
      const initialContent = `<h1>${finalTitle}</h1><p>Contenido de la nota...</p>`;
      
      const { data, error } = await supabase
        .from('shared_notes')
        .insert([{ 
          project_id: projectId, 
          title: finalTitle,
          content: initialContent, 
          last_edited_by: user.id 
        }])
        .select()
        .single();

      if (error) throw error;
      
      await fetchNotes();
      return { ...data };
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateNote = async (noteId: string, content: string, title: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('shared_notes')
        .update({ 
          title,
          content, 
          last_edited_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId);

      if (error) throw error;
      
      await fetchNotes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      // Usar la función RPC para eliminar la nota y su historial
      const { error } = await supabase.rpc('delete_shared_note', {
        note_id: noteId
      });

      if (error) throw error;
      
      await fetchNotes();
      toast({
        title: "Nota eliminada",
        description: "La nota ha sido eliminada correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  return {
    notes,
    loading,
    createNote,
    updateNote,
    deleteNote,
    refetch: fetchNotes,
  };
}