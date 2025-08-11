import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SharedNote {
  id: string;
  project_id: string;
  content: string;
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
  const [note, setNote] = useState<SharedNote | null>(null);
  const [history, setHistory] = useState<SharedNoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchNote = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('shared_notes')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;
      setNote(data);
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

  const fetchHistory = async () => {
    if (!note?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('shared_notes_history')
        .select('*')
        .eq('note_id', note.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching history:', error);
    }
  };

  const createOrUpdateNote = async (content: string, userId?: string) => {
    if (!projectId) return;
    
    try {
      if (note) {
        const { error } = await supabase
          .from('shared_notes')
          .update({ 
            content, 
            last_edited_by: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', note.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shared_notes')
          .insert([{ 
            project_id: projectId, 
            content, 
            last_edited_by: userId 
          }]);

        if (error) throw error;
      }
      
      await fetchNote();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchNote();
  }, [projectId]);

  useEffect(() => {
    if (note) {
      fetchHistory();
    }
  }, [note]);

  return {
    note,
    history,
    loading,
    createOrUpdateNote,
    refetch: fetchNote,
  };
}