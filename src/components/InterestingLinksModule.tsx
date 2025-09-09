import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      await loadLinks();
      setIsDialogOpen(false);
      setName('');
      setUrl('');
      setDescription('');
      
      toast({
        title: "Éxito",
        description: "Enlace añadido correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
            <div>
              <CardTitle>Enlaces de interés</CardTitle>
              <CardDescription>
                Enlaces importantes del proyecto
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo enlace
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando enlaces...</div>
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay enlaces registrados
            </div>
          ) : (
            <div className="grid gap-4">
              {links.map((link) => (
                <Card key={link.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{link.name}</h3>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 break-all">
                          {link.url}
                        </p>
                        {link.description && (
                          <p className="text-sm">
                            {link.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Creado el {new Date(link.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(link.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Link Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo enlace</DialogTitle>
            <DialogDescription>
              Añade un enlace de interés para el proyecto
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
            
            <Button type="submit" className="w-full">
              Añadir enlace
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}