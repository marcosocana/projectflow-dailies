import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useReleases, Release } from '@/hooks/useReleases';

import { Plus, Smartphone, Globe, Eye, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react';

interface ReleasesModuleProps {
  projectId: string;
}

export default function ReleasesModule({ projectId }: ReleasesModuleProps) {
  const { releases, loading, createRelease, updateRelease, deleteRelease } = useReleases(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [platform, setPlatform] = useState<'web' | 'app'>('web');
  const [environment, setEnvironment] = useState<'dev' | 'pre' | 'pro'>('pro');
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  
  // Edit form states
  const [editPlatform, setEditPlatform] = useState<'web' | 'app'>('web');
  const [editEnvironment, setEditEnvironment] = useState<'dev' | 'pre' | 'pro'>('pro');
  const [editVersion, setEditVersion] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Check if any environment has more than 3 releases
  const hasMoreThanThree = () => {
    const webByEnv = groupReleasesByEnvironment(releases.filter(r => r.platform === 'web'));
    const appByEnv = groupReleasesByEnvironment(releases.filter(r => r.platform === 'app'));
    
    return Object.values(webByEnv).some(envReleases => envReleases.length > 3) ||
           Object.values(appByEnv).some(envReleases => envReleases.length > 3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!version.trim()) return;

    await createRelease({
      project_id: projectId,
      platform,
      environment,
      version: version.trim(),
      description: description.trim() || null,
    });

    setIsDialogOpen(false);
    setVersion('');
    setDescription('');
    setPlatform('web');
    setEnvironment('pro');
  };

  const handleViewDetail = (release: Release) => {
    setSelectedRelease(release);
    setEditPlatform(release.platform);
    setEditEnvironment(release.environment);
    setEditVersion(release.version);
    setEditDescription(release.description || '');
    setIsEditing(false);
    setIsDetailDialogOpen(true);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRelease || !editVersion.trim()) return;
    
    await updateRelease(selectedRelease.id, {
      platform: editPlatform,
      environment: editEnvironment,
      version: editVersion.trim(),
      description: editDescription.trim() || null,
    });
    
    setIsEditing(false);
    setIsDetailDialogOpen(false);
    setSelectedRelease(null);
  };

  const handleCancelEdit = () => {
    setEditPlatform(selectedRelease?.platform || 'web');
    setEditEnvironment(selectedRelease?.environment || 'pro');
    setEditVersion(selectedRelease?.version || '');
    setEditDescription(selectedRelease?.description || '');
    setIsEditing(false);
  };

  const handleDeleteRelease = async (releaseId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este release?')) {
      return;
    }

    await deleteRelease(releaseId);
    setIsDetailDialogOpen(false);
    setSelectedRelease(null);
  };

  // Group releases by platform and environment
  const groupReleasesByEnvironment = (releases: Release[]) => {
    return releases.reduce((acc, release) => {
      if (!acc[release.environment]) {
        acc[release.environment] = [];
      }
      acc[release.environment].push(release);
      return acc;
    }, {} as Record<string, Release[]>);
  };

  const webReleases = releases.filter(r => r.platform === 'web');
  const appReleases = releases.filter(r => r.platform === 'app');
  const webByEnvironment = groupReleasesByEnvironment(webReleases);
  const appByEnvironment = groupReleasesByEnvironment(appReleases);

  // Get displayed releases based on expanded state
  const getDisplayedReleases = (envReleases: Release[]) => {
    return expanded ? envReleases : envReleases.slice(0, 3);
  };

  const getEnvironmentLabel = (env: string) => {
    const labels = { dev: 'Desarrollo', pre: 'Preproducción', pro: 'Producción' };
    return labels[env as keyof typeof labels] || env;
  };

  const getEnvironmentColor = (env: string) => {
    const colors = { dev: 'bg-blue-100 text-blue-800', pre: 'bg-yellow-100 text-yellow-800', pro: 'bg-green-100 text-green-800' };
    return colors[env as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getAvailableEnvironments = (platform: 'web' | 'app'): Array<'dev' | 'pre' | 'pro'> => {
    return platform === 'web' ? ['dev', 'pre', 'pro'] : ['pre', 'pro'];
  };

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
            <div className="flex gap-2">
              {hasMoreThanThree() && (
                <Button 
                  variant="outline" 
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-2"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Ver más
                    </>
                  )}
                </Button>
              )}
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir release
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando releases...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Web Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">Web</h3>
                  <Badge variant="secondary">{webReleases.length}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {['dev', 'pre', 'pro'].map(env => {
                    const envReleases = webByEnvironment[env] || [];
                    return (
                      <div key={env} className="space-y-2">
                        <div className="text-center">
                          <Badge className={getEnvironmentColor(env)} variant="secondary">
                            {getEnvironmentLabel(env)}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {envReleases.length} ver{envReleases.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="space-y-1">
                          {envReleases.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-xs">
                              Sin releases
                            </div>
                          ) : (
                            getDisplayedReleases(envReleases).map((release, index) => (
                              <Card key={release.id} className="border">
                                <CardContent className="p-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="font-mono text-xs px-1 py-0">
                                        v{release.version}
                                      </Badge>
                                      {index === 0 && (
                                        <Badge variant="default" className="text-xs px-1 py-0">
                                          Actual
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(release.created_at).toLocaleDateString('es-ES', { 
                                          day: '2-digit', 
                                          month: '2-digit' 
                                        })}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewDetail(release)}
                                        aria-label="Ver detalle"
                                        className="h-5 w-5 p-0"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* App Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  <h3 className="text-lg font-semibold">App</h3>
                  <Badge variant="secondary">{appReleases.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {['pre', 'pro'].map(env => {
                    const envReleases = appByEnvironment[env] || [];
                    return (
                      <div key={env} className="space-y-2">
                        <div className="text-center">
                          <Badge className={getEnvironmentColor(env)} variant="secondary">
                            {getEnvironmentLabel(env)}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {envReleases.length} ver{envReleases.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="space-y-1">
                          {envReleases.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-xs">
                              Sin releases
                            </div>
                          ) : (
                            getDisplayedReleases(envReleases).map((release, index) => (
                              <Card key={release.id} className="border">
                                <CardContent className="p-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="font-mono text-xs px-1 py-0">
                                        v{release.version}
                                      </Badge>
                                      {index === 0 && (
                                        <Badge variant="default" className="text-xs px-1 py-0">
                                          Actual
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(release.created_at).toLocaleDateString('es-ES', { 
                                          day: '2-digit', 
                                          month: '2-digit' 
                                        })}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewDetail(release)}
                                        aria-label="Ver detalle"
                                        className="h-5 w-5 p-0"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
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
              <Select value={platform} onValueChange={(value: 'web' | 'app') => {
                setPlatform(value);
                // Reset environment when platform changes and set default
                const defaultEnv = value === 'web' ? 'pro' : 'pro';
                setEnvironment(defaultEnv);
              }}>
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
              <Label htmlFor="environment">Entorno</Label>
              <Select value={environment} onValueChange={(value: 'dev' | 'pre' | 'pro') => setEnvironment(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el entorno" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableEnvironments(platform).map(env => (
                    <SelectItem key={env} value={env}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          env === 'dev' ? 'bg-blue-500' : 
                          env === 'pre' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        {getEnvironmentLabel(env)}
                      </div>
                    </SelectItem>
                  ))}
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

      {/* Release Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalle del Release</DialogTitle>
            <DialogDescription>Consulta o edita los datos del release seleccionado.</DialogDescription>
          </DialogHeader>
          
          {selectedRelease && (
            <div className="space-y-4">
              <div>
                <Label>Plataforma</Label>
                {isEditing ? (
                  <Select value={editPlatform} onValueChange={(value: 'web' | 'app') => {
                    setEditPlatform(value);
                    // Reset environment when platform changes and set default
                    const defaultEnv = value === 'web' ? 'pro' : 'pro';
                    setEditEnvironment(defaultEnv);
                  }}>
                    <SelectTrigger className="mt-1">
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
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    {selectedRelease.platform === 'web' ? (
                      <>
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span>Web</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4 text-green-500" />
                        <span>App</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <Label>Entorno</Label>
                {isEditing ? (
                  <Select value={editEnvironment} onValueChange={(value: 'dev' | 'pre' | 'pro') => setEditEnvironment(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona el entorno" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableEnvironments(editPlatform).map(env => (
                        <SelectItem key={env} value={env}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              env === 'dev' ? 'bg-blue-500' : 
                              env === 'pre' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            {getEnvironmentLabel(env)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    <Badge className={getEnvironmentColor(selectedRelease.environment)}>
                      {getEnvironmentLabel(selectedRelease.environment)}
                    </Badge>
                  </div>
                )}
              </div>
              
              <div>
                <Label>Versión</Label>
                {isEditing ? (
                  <Input
                    value={editVersion}
                    onChange={(e) => setEditVersion(e.target.value)}
                    className="mt-1"
                    placeholder="ej: 1.0.0"
                  />
                ) : (
                  <div className="mt-1">
                    <Badge variant="outline" className="font-mono">
                      v{selectedRelease.version}
                    </Badge>
                  </div>
                )}
              </div>
              
              <div>
                <Label>Qué incluye</Label>
                {isEditing ? (
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1"
                    placeholder="Describe las nuevas características, mejoras o correcciones..."
                    rows={4}
                  />
                ) : (
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedRelease.description || 'Sin descripción'}
                    </p>
                  </div>
                )}
              </div>
              
              <div>
                <Label>Fecha de creación</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(selectedRelease.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              
              <div className="flex justify-between pt-4 border-t">
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} className="flex items-center gap-2">
                      Guardar
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleEdit}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => selectedRelease && handleDeleteRelease(selectedRelease.id)}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}