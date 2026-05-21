import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { supabase } from '@/integrations/supabase/client';
import { getActivityLogLastSeen, subscribeToActivityLogReadState } from '@/lib/activityLogReadState';
import CreateProjectForm from '@/components/CreateProjectForm';
import IncidentsModule from '@/components/IncidentsModule';
import ActivityLogModule from '@/components/ActivityLogModule';
import ReleasesModule from '@/components/ReleasesModule';
import InterestingLinksModule from '@/components/InterestingLinksModule';
import VacationsModule from '@/components/VacationsModule';
import NotesModule from '@/components/NotesModule';
import ContactsModule from '@/components/ContactsModule';
import RepositoryModule from '@/components/RepositoryModule';
// import HomeModule from '@/components/HomeModule';
import InternalConfigModule from '@/components/InternalConfigModule';
import UsersModule from '@/components/UsersModule';
import UserProfileModule from '@/components/UserProfileModule';
import { AppSidebar } from '@/components/AppSidebar';
import BacklogComparePanel from '@/components/BacklogComparePanel';
import NoteDetail from '@/components/NoteDetail';
import NoteCreate from '@/components/NoteCreate';
import ScrollToTop from '@/components/ScrollToTop';
import { GitCompareArrows, LogOut, Menu, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import vecturaLogo from '@/assets/vectura-logo.png';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const Dashboard = () => {
  const [projectPassword, setProjectPassword] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [compareBacklogOpen, setCompareBacklogOpen] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [projectSelectionReady, setProjectSelectionReady] = useState(false);
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const {
    accessProject,
    accessProjectDirectly,
    currentProject,
    fetchUserProjects,
    isAccessing,
    leaveProject,
    loadingProjects,
    userProjects,
  } = useProjectAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperUser = user?.email?.toLowerCase() === 'mocanat@minsait.com';
  const hasAdminPasswordAccess = sessionStorage.getItem('projectflow_admin_access') === 'true';
  const canOpenAdmin = isSuperUser || isAdminRole || hasAdminPasswordAccess;

  useEffect(() => {
    let isMounted = true;

    const loadAdminRole = async () => {
      if (!user) {
        setIsAdminRole(false);
        return;
      }
      const { data } = await supabase.rpc('current_user_is_admin');
      if (isMounted) setIsAdminRole(Boolean(data));
    };

    loadAdminRole();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const refreshUnreadActivity = useCallback(async () => {
    if (!currentProject?.id) {
      setHasUnreadActivity(false);
      return;
    }

    const lastSeen = getActivityLogLastSeen(currentProject.id, user?.id);
    const { data, error } = await supabase
      .from('incident_activity_logs')
      .select('created_at')
      .eq('project_id', currentProject.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.created_at) {
      setHasUnreadActivity(false);
      return;
    }

    setHasUnreadActivity(!lastSeen || new Date(data.created_at).getTime() > new Date(lastSeen).getTime());
  }, [currentProject?.id, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadUserProjects = async () => {
      if (!user || currentProject) {
        if (isMounted) setProjectSelectionReady(true);
        return;
      }

      const projects = await fetchUserProjects();
      if (!isMounted) return;

      if (projects.length === 1) {
        await accessProjectDirectly(projects[0]);
      }

      setProjectSelectionReady(true);
    };

    loadUserProjects();

    return () => {
      isMounted = false;
    };
  }, [user, currentProject]);

  useEffect(() => {
    refreshUnreadActivity();
  }, [refreshUnreadActivity]);

  useEffect(() => {
    const unsubscribe = subscribeToActivityLogReadState(refreshUnreadActivity);
    return unsubscribe;
  }, [refreshUnreadActivity]);

  useEffect(() => {
    if (!currentProject?.id) return undefined;

    const channel = supabase
      .channel(`mobile-activity-log-unread-${currentProject.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incident_activity_logs',
          filter: `project_id=eq.${currentProject.id}`,
        },
        () => {
          refreshUnreadActivity();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, refreshUnreadActivity]);

  const handleSignOut = async () => {
    await signOut();
    leaveProject();
    sessionStorage.removeItem('projectflow_admin_access');
    navigate('/');
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente."
    });
  };

  const handleProjectAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (projectPassword === 'AdminProjects01') {
        setProjectPassword('');
        sessionStorage.setItem('projectflow_admin_access', 'true');
        navigate('/admin');
        return;
      }
      
      if (projectPassword === 'NewProject01') {
        setProjectPassword('');
        setCreateProjectOpen(true);
        return;
      }
      
      await accessProject(projectPassword);
      setProjectPassword('');
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleProjectCreated = (projectId: string, projectNumber: number) => {
    setCreateProjectOpen(false);
    toast({
      title: "Proyecto creado exitosamente",
      description: `Proyecto número ${projectNumber} creado. Puedes acceder a él ahora.`
    });
  };

  const handleCompareIdSelect = (id: string) => {
    navigate(`/tasks?search=${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white h-[64px] flex items-center">
        <div className="relative w-full h-full flex items-center justify-center px-3 md:px-6">
          {/* Bloque izquierdo: logo + título */}
          <div className="absolute left-2 right-28 md:left-[10px] md:right-auto flex min-w-0 items-center gap-2">
            {currentProject?.logo_url ? (
              <img
                src={currentProject.logo_url}
                alt={`${currentProject.name} logo`}
                className="h-8 md:h-10 max-w-10 md:max-w-none w-auto shrink-0 object-contain"
              />
            ) : (
              <img
                src={vecturaLogo}
                alt="Vectorea"
                className="h-8 md:h-10 max-w-10 md:max-w-none w-auto shrink-0 object-contain"
              />
            )}
            <h1 className="min-w-0 truncate text-lg md:text-2xl font-bold">
              {currentProject ? currentProject.name : 'Vectorea'}
            </h1>
          </div>

          {/* Bloque derecho: menú móvil + email (oculto en móvil) + cerrar sesión */}
          <div className="absolute right-2 md:right-[15px] flex items-center gap-2 md:gap-4">
            {/* Menú hamburguesa en móvil */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative md:hidden" aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
                  {hasUnreadActivity && (
                    <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-white" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle>Menú</SheetTitle>
                </SheetHeader>
                <nav className="mt-4 grid gap-2">
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/tasks">Home</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/activity">
                      <span>Actividad</span>
                      {hasUnreadActivity && (
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
                      )}
                    </a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/releases">Releases</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/vacations">Ausencias</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/repository">Repositorio</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/notes">Wiki</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/contacts">Contactos</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/links">Enlaces de interés</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/config">Seguimiento</a>
                  </Button>
                  {currentProject && (
                    <Button variant="ghost" className="justify-start" onClick={() => setCompareBacklogOpen(true)}>
                      Comparar con backlog
                    </Button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            {currentProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompareBacklogOpen(true)}
                className="hidden items-center gap-2 md:flex"
              >
                <GitCompareArrows className="h-4 w-4" />
                Comparar con backlog
              </Button>
            )}

            <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Perfil de usuario">
                  <User className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-[600px] sm:max-w-[90vw] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle></SheetTitle>
                </SheetHeader>
                {canOpenAdmin && (
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate('/admin');
                      }}
                      className="w-full justify-start gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </Button>
                  </div>
                )}
                <div className="mt-6">
                  {currentProject && <UserProfileModule projectId={currentProject.id} />}
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSignOut}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </header>


      <main className="w-full pt-[94px] py-0 px-0">
        {!currentProject ? (
          <div className="max-w-4xl mx-auto space-y-6 px-4 md:px-0">
            {!projectSelectionReady || loadingProjects ? (
              <Card>
                <CardContent className="flex items-center justify-center py-10">
                  <div className="text-muted-foreground">Cargando proyectos...</div>
                </CardContent>
              </Card>
            ) : userProjects.length > 1 ? (
              <Card>
                <CardHeader className="text-center space-y-4">
                  <div className="flex justify-center">
                    <img src={vecturaLogo} alt="Vectorea" className="h-16 w-auto object-contain" />
                  </div>
                  <div>
                    <CardTitle>Selecciona un proyecto</CardTitle>
                    <CardDescription>
                      Tienes acceso a varios proyectos. Elige con cuál quieres trabajar.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {userProjects.map(project => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => accessProjectDirectly(project)}
                        className="flex items-center gap-4 rounded-md border p-4 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {project.logo_url ? (
                          <img src={project.logo_url} alt={`${project.name} logo`} className="h-10 w-10 object-contain" />
                        ) : (
                          <div className="h-10 w-10 rounded border" style={{ backgroundColor: project.theme_color }} />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{project.name}</div>
                          <div className="text-sm text-muted-foreground">Proyecto #{project.project_number}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
            <>
            {/* Acceso con contraseña */}
            <Card>
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <img src={vecturaLogo} alt="Vectorea" className="h-16 w-auto object-contain" />
                </div>
                <div>
                  <CardTitle>Acceso a Proyectos</CardTitle>
                  <CardDescription>
                    Introduce la contraseña para acceder
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProjectAccess} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-password">Contraseña</Label>
                    <Input 
                      id="project-password" 
                      type="password" 
                      value={projectPassword} 
                      onChange={e => setProjectPassword(e.target.value)} 
                      placeholder="Introduce la contraseña" 
                      required 
                    />
                  </div>
                  <Button type="submit" disabled={isAccessing} className="w-full">
                    {isAccessing ? 'Accediendo...' : 'Acceder'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Create Project Modal */}
            <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear nuevo proyecto</DialogTitle>
                  <DialogDescription>Completa la información del proyecto</DialogDescription>
                </DialogHeader>
                <CreateProjectForm onProjectCreated={handleProjectCreated} onClose={() => setCreateProjectOpen(false)} />
              </DialogContent>
            </Dialog>
            </>
            )}
          </div>
        ) : (
          <div className="min-h-screen">
            {!location.pathname.endsWith('/tasks') && (
              <div className="hidden">
                <IncidentsModule projectId={currentProject.id} />
              </div>
            )}
            <AppSidebar currentProject={currentProject} />
            <main className="ml-0 md:ml-16 p-4 md:p-6 2xl:px-10 pt-[64px]">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <ScrollToTop />
                  <Routes>
                    <Route path="/" element={<Navigate to="tasks" replace />} />
                    <Route path="tasks" element={<IncidentsModule projectId={currentProject.id} />} />
                    <Route path="activity" element={<ActivityLogModule projectId={currentProject.id} />} />
                    <Route path="releases" element={<ReleasesModule projectId={currentProject.id} />} />
                    <Route path="vacations" element={<VacationsModule projectId={currentProject.id} />} />
                    <Route path="repository" element={<RepositoryModule projectId={currentProject.id} />} />
                    <Route path="notes" element={<NotesModule projectId={currentProject.id} />} />
                    <Route path="notes/new" element={<NoteCreate projectId={currentProject.id} />} />
                    <Route path="notes/:noteId" element={<NoteDetail projectId={currentProject.id} />} />
                    <Route path="contacts" element={<ContactsModule projectId={currentProject.id} />} />
                    <Route path="links" element={<InterestingLinksModule projectId={currentProject.id} />} />
                    <Route path="config" element={<InternalConfigModule projectId={currentProject.id} dailiesPassword={(currentProject as any).dailies_password || 'default'} />} />
                    <Route path="users" element={<UsersModule projectId={currentProject.id} />} />
                  </Routes>
                </div>
                {compareBacklogOpen && (
                  <BacklogComparePanel
                    projectId={currentProject.id}
                    onClose={() => setCompareBacklogOpen(false)}
                    onSelectId={handleCompareIdSelect}
                  />
                )}
              </div>
            </main>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
