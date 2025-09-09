import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RepositoryFile {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  password_required: boolean;
  password_hash: string | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useRepositoryFiles(projectId?: string) {
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFiles = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('repository_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data as RepositoryFile[] || []);
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

  const uploadFile = async (file: File, projectId: string, password?: string, description?: string) => {
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Hash password if provided
      let passwordHash = null;
      if (password) {
        // Simple hash - in production, use bcrypt or similar
        passwordHash = btoa(password);
      }

      // Save file metadata to database
      const { error: dbError } = await supabase
        .from('repository_files')
        .insert([{
          project_id: projectId,
          name: file.name,
          file_path: filePath,
          file_size: file.size,
          content_type: file.type,
          password_required: !!password,
          password_hash: passwordHash,
          description: description || null,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id || null,
        }]);

      if (dbError) throw dbError;
      
      await fetchFiles();
      toast({
        title: "Éxito",
        description: "Archivo subido correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const downloadFile = async (file: RepositoryFile, password?: string) => {
    try {
      // Check password if required
      if (file.password_required && file.password_hash) {
        if (!password || btoa(password) !== file.password_hash) {
          throw new Error('Contraseña incorrecta');
        }
      }

      // Download from Supabase Storage
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Éxito",
        description: "Archivo descargado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (file: RepositoryFile) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('repository_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;
      
      await fetchFiles();
      toast({
        title: "Éxito",
        description: "Archivo eliminado correctamente",
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
    fetchFiles();
  }, [projectId]);

  return {
    files,
    loading,
    uploadFile,
    downloadFile,
    deleteFile,
    refetch: fetchFiles,
  };
}