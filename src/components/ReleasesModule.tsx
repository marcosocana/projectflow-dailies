import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Smartphone, Globe } from 'lucide-react';

interface ReleasesModuleProps {
  projectId: string;
}

interface Release {
  id: string;
  platform: 'web' | 'app';
  version: string;
  description: string | null;
  created_at: string;
}

export default function ReleasesModule({ projectId }: ReleasesModuleProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<'web' | 'app'>('web');
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();

  const loadReleases = async () => {
    try {
      const { data, error } = await supabase
        .from('releases')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReleases(data as Release[] || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los releases",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReleases();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!version.trim()) {
      toast({
        title: "Error",
        description: "El número de versión es obligatorio",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('releases')
        .insert({
          project_id: projectId,
          platform,
          version: version.trim(),
          description: description.trim() || null,
        });

      if (error) throw error;

      await loadReleases();
      setIsDialogOpen(false);
      setVersion('');
      setDescription('');
      setPlatform('web');
      
      toast({
        title: "Éxito",
        description: "Release añadido correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const webReleases = releases.filter(r => r.platform === 'web');
  const appReleases = releases.filter(r => r.platform === 'app');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Releases</CardTitle>
              <CardDescription>
                Registro de versiones de Web y App
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir release
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando releases...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Web Column */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">Web</h3>
                  <Badge variant="secondary">{webReleases.length}</Badge>
                </div>
                <div className="space-y-3">
                  {webReleases.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay releases de Web
                    </div>
                  ) : (
                    webReleases.map((release) => (
                      <Card key={release.id} className="border-2">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="font-mono">
                              v{release.version}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(release.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {release.description && (
                            <p className="text-sm text-muted-foreground">
                              {release.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              {/* App Column */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  <h3 className="text-lg font-semibold">App</h3>
                  <Badge variant="secondary">{appReleases.length}</Badge>
                </div>
                <div className="space-y-3">
                  {appReleases.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay releases de App
                    </div>
                  ) : (
                    appReleases.map((release) => (
                      <Card key={release.id} className="border-2">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="font-mono">
                              v{release.version}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(release.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {release.description && (
                            <p className="text-sm text-muted-foreground">
                              {release.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Release Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Añadir release</DialogTitle>
            <DialogDescription>
              Registra una nueva versión de Web o App
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="platform">Plataforma</Label>
              <Select value={platform} onValueChange={(value: 'web' | 'app') => setPlatform(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Web
                    </div>
                  </SelectItem>
                  <SelectItem value="app">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      App
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="version">Número de versión</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="ej: 1.0.0"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Qué incluye</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe las nuevas características, mejoras o correcciones..."
                rows={4}
              />
            </div>
            
            <Button type="submit" className="w-full">
              Añadir release
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}