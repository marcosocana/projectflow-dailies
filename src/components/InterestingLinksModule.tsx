import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ExternalLink, Trash2, Edit } from 'lucide-react';

interface InterestingLinksModuleProps {
  projectId: string;
}

interface InterestingLink {
  id: string;
  name: string;
  url: string;
  description: string | null;
  created_at: string;
}

export default function InterestingLinksModule({ projectId }: InterestingLinksModuleProps) {
  const [links, setLinks] = useState<InterestingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<InterestingLink | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();

  const loadLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('interesting_links')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los enlaces",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, [projectId]);

  useEffect(() => {
    if (!editingLink || !isDialogOpen) return;
    if (!name.trim() || !url.trim()) return;
    try {
      new URL(url);
    } catch {
      return;
    }

    const handler = setTimeout(async () => {
      const { error } = await supabase
        .from('interesting_links')
        .update({
          name: name.trim(),
          url: url.trim(),
          description: description.trim() || null,
        })
        .eq('id', editingLink.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      setLinks(prev => prev.map(link => link.id === editingLink.id ? {
        ...link,
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || null,
      } : link));
      setEditingLink(prev => prev ? {
        ...prev,
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || null,
      } : prev);
    }, 500);

    return () => clearTimeout(handler);
  }, [editingLink?.id, isDialogOpen, name, url, description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLink) return;
    
    if (!name.trim() || !url.trim()) {
      toast({
        title: "Error",
        description: "El nombre y la dirección del enlace son obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast({
        title: "Error",
        description: "La dirección del enlace no es válida",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('interesting_links')
        .insert({
          project_id: projectId,
          name: name.trim(),
          url: url.trim(),
          description: description.trim() || null,
        });

      if (error) throw error;
      toast({
        title: "Éxito",
        description: "Enlace añadido correctamente",
      });

      await loadLinks();
      setIsDialogOpen(false);
      setEditingLink(null);
      setName('');
      setUrl('');
      setDescription('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (link: InterestingLink) => {
    setEditingLink(link);
    setName(link.name);
    setUrl(link.url);
    setDescription(link.description || '');
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este enlace?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('interesting_links')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadLinks();
      toast({
        title: "Éxito",
        description: "Enlace eliminado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Enlaces de interés</CardTitle>
            <Button onClick={() => { setEditingLink(null); setName(''); setUrl(''); setDescription(''); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo enlace
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ExternalLink className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p>No hay enlaces registrados aún</p>
              <p className="text-sm text-muted-foreground mt-1">Crea el primer enlace para empezar</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((link) => (
                <Card key={link.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg truncate mr-2">
                        {link.name}
                      </CardTitle>
                      <div className="flex gap-1 ml-auto">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(link)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(link.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground truncate">
                      {link.url}
                    </p>
                    {link.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {link.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Link Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingLink(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingLink ? 'Editar enlace' : 'Nuevo enlace'}</DialogTitle>
            <DialogDescription>
              {editingLink ? 'Modifica la información del enlace' : 'Añade un enlace de interés para el proyecto'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej: Documentación de la API"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="url">Dirección enlace</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ejemplo.com"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Detalles del enlace</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe para qué sirve este enlace o qué información contiene..."
                rows={4}
              />
            </div>
            
            {!editingLink && (
              <Button type="submit" className="w-full">
                Añadir enlace
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
