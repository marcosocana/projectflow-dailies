import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useReleases, Release, ReleaseIncludedTask } from '@/hooks/useReleases';

import { Plus, Smartphone, Globe, Eye, Trash2, Edit, ChevronDown, ChevronUp, Copy, X } from 'lucide-react';

interface ReleasesModuleProps {
  projectId: string;
}

export default function ReleasesModule({ projectId }: ReleasesModuleProps) {
  const { releases, loading, createRelease, updateRelease, deleteRelease } = useReleases(projectId);
  const [availableTasks, setAvailableTasks] = useState<ReleaseIncludedTask[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [platform, setPlatform] = useState<'web' | 'app'>('web');
  const [environment, setEnvironment] = useState<'dev' | 'pre' | 'pro'>('pro');
  const [version, setVersion] = useState('');
  const [includedTasks, setIncludedTasks] = useState<ReleaseIncludedTask[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualTaskTitle, setManualTaskTitle] = useState('');
  
  // Edit form states
  const [editPlatform, setEditPlatform] = useState<'web' | 'app'>('web');
  const [editEnvironment, setEditEnvironment] = useState<'dev' | 'pre' | 'pro'>('pro');
  const [editVersion, setEditVersion] = useState('');
  const [editIncludedTasks, setEditIncludedTasks] = useState<ReleaseIncludedTask[]>([]);
  const [editTaskSearch, setEditTaskSearch] = useState('');
  const [editManualTaskId, setEditManualTaskId] = useState('');
  const [editManualTaskTitle, setEditManualTaskTitle] = useState('');

  useEffect(() => {
    const fetchAvailableTasks = async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, incident_number, name')
        .eq('project_id', projectId)
        .order('incident_number', { ascending: false });

      if (error) {
        console.error('Error fetching release task options:', error);
        return;
      }

      setAvailableTasks((data || []).map(task => ({
        id: String(task.incident_number),
        title: task.name,
        source: 'existing',
        taskId: task.id,
      })));
    };

    fetchAvailableTasks();
  }, [projectId]);

  const normalizeIncludedTasks = (value: Release['included_tasks'] | null | undefined): ReleaseIncludedTask[] => {
    if (!Array.isArray(value)) return [];

    return value
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
      .map(item => ({
        id: String(item.id || '').trim(),
        title: String(item.title || '').trim(),
        source: item.source === 'manual' ? 'manual' : 'existing',
        taskId: typeof item.taskId === 'string' ? item.taskId : undefined,
      }))
      .filter(item => item.id && item.title);
  };

  const formatIncludedTasks = (tasks: ReleaseIncludedTask[], fallbackDescription?: string | null) => {
    if (tasks.length > 0) {
      return tasks.map(task => `${task.id} - ${task.title}`).join('\n');
    }

    return fallbackDescription || 'Sin tareas vinculadas';
  };

  const hasTask = (tasks: ReleaseIncludedTask[], task: ReleaseIncludedTask) => {
    return tasks.some(item => {
      if (task.taskId && item.taskId) return item.taskId === task.taskId;
      return item.id.toLowerCase() === task.id.toLowerCase();
    });
  };

  const toggleTask = (
    task: ReleaseIncludedTask,
    setTasks: React.Dispatch<React.SetStateAction<ReleaseIncludedTask[]>>
  ) => {
    setTasks(currentTasks => {
      if (hasTask(currentTasks, task)) {
        return currentTasks.filter(item => (task.taskId && item.taskId) ? item.taskId !== task.taskId : item.id.toLowerCase() !== task.id.toLowerCase());
      }

      return [...currentTasks, task];
    });
  };

  const removeTask = (
    task: ReleaseIncludedTask,
    setTasks: React.Dispatch<React.SetStateAction<ReleaseIncludedTask[]>>
  ) => {
    setTasks(current => current.filter(item => (task.taskId && item.taskId) ? item.taskId !== task.taskId : item.id.toLowerCase() !== task.id.toLowerCase()));
  };

  const addManualTask = (
    currentTasks: ReleaseIncludedTask[],
    setTasks: React.Dispatch<React.SetStateAction<ReleaseIncludedTask[]>>,
    id: string,
    title: string,
    reset: () => void
  ) => {
    const task: ReleaseIncludedTask = {
      id: id.trim(),
      title: title.trim(),
      source: 'manual',
    };

    if (!task.id || !task.title || hasTask(currentTasks, task)) return;

    setTasks([...currentTasks, task]);
    reset();
  };

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
      description: null,
      included_tasks: includedTasks,
    });

    setIsDialogOpen(false);
    setVersion('');
    setIncludedTasks([]);
    setTaskSearch('');
    setManualTaskId('');
    setManualTaskTitle('');
    setPlatform('web');
    setEnvironment('pro');
  };

  const handleViewDetail = (release: Release) => {
    setSelectedRelease(release);
    setEditPlatform(release.platform);
    setEditEnvironment(release.environment);
    setEditVersion(release.version);
    setEditIncludedTasks(normalizeIncludedTasks(release.included_tasks));
    setEditTaskSearch('');
    setEditManualTaskId('');
    setEditManualTaskTitle('');
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
      description: null,
      included_tasks: editIncludedTasks,
    });
    
    setIsEditing(false);
    setIsDetailDialogOpen(false);
    setSelectedRelease(null);
  };

  const handleCancelEdit = () => {
    setEditPlatform(selectedRelease?.platform || 'web');
    setEditEnvironment(selectedRelease?.environment || 'pro');
    setEditVersion(selectedRelease?.version || '');
    setEditIncludedTasks(normalizeIncludedTasks(selectedRelease?.included_tasks));
    setEditTaskSearch('');
    setEditManualTaskId('');
    setEditManualTaskTitle('');
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

  const copyReleaseInfo = async (release: Release) => {
    const platformLabel = release.platform === 'web' ? 'Web' : 'App';
    const environmentLabel = getEnvironmentLabel(release.environment);
    const formattedDate = new Date(release.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const releaseInfo = `Fecha: ${formattedDate}
Plataforma: ${platformLabel}
Entorno: ${environmentLabel}
Versión: v${release.version}
Qué incluye:
${formatIncludedTasks(normalizeIncludedTasks(release.included_tasks), release.description)}`;

    try {
      await navigator.clipboard.writeText(releaseInfo);
      // You could add a toast here if you have toast functionality
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
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

  const dialogContentClassName = 'w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden sm:w-[720px] sm:max-w-[720px]';
  const formGroupClassName = 'grid min-w-0 max-w-full gap-2';

  const renderIncludedTasksEditor = ({
    tasks,
    setTasks,
    search,
    setSearch,
    manualId,
    setManualId,
    manualTitle,
    setManualTitle,
  }: {
    tasks: ReleaseIncludedTask[];
    setTasks: React.Dispatch<React.SetStateAction<ReleaseIncludedTask[]>>;
    search: string;
    setSearch: React.Dispatch<React.SetStateAction<string>>;
    manualId: string;
    setManualId: React.Dispatch<React.SetStateAction<string>>;
    manualTitle: string;
    setManualTitle: React.Dispatch<React.SetStateAction<string>>;
  }) => {
    const query = search.trim().toLowerCase();
    const filteredTasks = availableTasks.filter(task => {
      if (!query) return true;
      return task.id.toLowerCase().includes(query) || task.title.toLowerCase().includes(query);
    });

    return (
      <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tarea existente por ID o título"
          className="min-w-0 max-w-full"
        />

        <ScrollArea className="h-36 min-w-0 max-w-full rounded-md border">
          <div className="space-y-1 p-2">
            {filteredTasks.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No se encontraron tareas</p>
            ) : (
              filteredTasks.map(task => {
                const selected = hasTask(tasks, task);
                return (
                  <div
                    key={task.taskId}
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={selected}
                    onClick={() => toggleTask(task, setTasks)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleTask(task, setTasks);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      tabIndex={-1}
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs text-muted-foreground">{task.id}</span>
                      <span className="block truncate">{task.title}</span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="grid min-w-0 max-w-full gap-2 sm:grid-cols-[140px_minmax(0,1fr)_44px]">
          <Input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="ID"
            className="min-w-0"
          />
          <Input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Título de la tarea"
            className="min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Añadir tarea manual"
            onClick={() => addManualTask(tasks, setTasks, manualId, manualTitle, () => {
              setManualId('');
              setManualTitle('');
            })}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {tasks.length > 0 && (
          <div className="max-h-[168px] min-w-0 overflow-y-auto rounded-md border bg-muted/30 p-2">
            <div className="flex flex-wrap gap-2 pr-2">
              {tasks.map(task => (
                <Badge key={`${task.source}-${task.taskId || task.id}`} variant="secondary" className="gap-1 pr-1">
                  <span className="max-w-[420px] min-w-0 truncate">{task.id} · {task.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Quitar tarea"
                    className="h-5 w-5 p-0 hover:bg-transparent"
                    onClick={() => removeTask(task, setTasks)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
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
        <DialogContent className={dialogContentClassName}>
          <DialogHeader>
            <DialogTitle>Añadir release</DialogTitle>
            <DialogDescription>
              Registra una nueva versión de Web o App
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="grid min-w-0 max-w-full gap-4 overflow-hidden py-4">
            <div className="grid min-w-0 max-w-full gap-3 md:grid-cols-3">
              <div className={formGroupClassName}>
                <Label htmlFor="platform">Plataforma</Label>
                <Select value={platform} onValueChange={(value: 'web' | 'app') => {
                  setPlatform(value);
                  const defaultEnv = value === 'web' ? 'pro' : 'pro';
                  setEnvironment(defaultEnv);
                }}>
                  <SelectTrigger className="min-w-0 max-w-full">
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

              <div className={formGroupClassName}>
                <Label htmlFor="environment">Entorno</Label>
                <Select value={environment} onValueChange={(value: 'dev' | 'pre' | 'pro') => setEnvironment(value)}>
                  <SelectTrigger className="min-w-0 max-w-full">
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

              <div className={formGroupClassName}>
                <Label htmlFor="version">Nº de versión</Label>
                <Input
                  id="version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="ej: 1.0.0"
                  required
                  className="min-w-0 max-w-full"
                />
              </div>
            </div>
            
            <div className={formGroupClassName}>
              <Label>Qué incluye</Label>
              {renderIncludedTasksEditor({
                tasks: includedTasks,
                setTasks: setIncludedTasks,
                search: taskSearch,
                setSearch: setTaskSearch,
                manualId: manualTaskId,
                setManualId: setManualTaskId,
                manualTitle: manualTaskTitle,
                setManualTitle: setManualTaskTitle,
              })}
            </div>
            
            <Button type="submit" className="w-full">
              Añadir release
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Release Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className={dialogContentClassName}>
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
                  <div className="mt-1">
                    {renderIncludedTasksEditor({
                      tasks: editIncludedTasks,
                      setTasks: setEditIncludedTasks,
                      search: editTaskSearch,
                      setSearch: setEditTaskSearch,
                      manualId: editManualTaskId,
                      setManualId: setEditManualTaskId,
                      manualTitle: editManualTaskTitle,
                      setManualTitle: setEditManualTaskTitle,
                    })}
                  </div>
                ) : (
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    {normalizeIncludedTasks(selectedRelease.included_tasks).length > 0 ? (
                      <div className="space-y-2">
                        {normalizeIncludedTasks(selectedRelease.included_tasks).map(task => (
                          <div key={`${task.source}-${task.taskId || task.id}`} className="flex gap-2 text-sm">
                            <span className="font-mono text-muted-foreground">{task.id}</span>
                            <span>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedRelease.description || 'Sin tareas vinculadas'}
                      </p>
                    )}
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleEdit}
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copyReleaseInfo(selectedRelease)}
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar info
                    </Button>
                  </div>
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
