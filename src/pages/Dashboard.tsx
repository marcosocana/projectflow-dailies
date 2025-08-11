import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import CreateProjectForm from '@/components/CreateProjectForm';
import IncidentsModule from '@/components/IncidentsModule';
import DailiesModule from '@/components/DailiesModule';
import VacationsModule from '@/components/VacationsModule';
import UsersModule from '@/components/UsersModule';
import NotesModule from '@/components/NotesModule';
import ProjectSettingsModule from '@/components/ProjectSettingsModule';
import { AppSidebar } from '@/components/AppSidebar';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import vecturaLogo from '@/assets/vectura-logo.png';
const Dashboard = () => {
  const [projectPassword, setProjectPassword] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { accessProject, accessProjectDirectly, fetchUserProjects, currentProject, userProjects, isAccessing, loadingProjects } = useProjectAccess();
  const navigate = useNavigate();
  const [showProjectsList, setShowProjectsList] = useState(false);
  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente.",
    });
  };

  const handleProjectAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (projectPassword === 'AdminProyectos') {
        setProjectPassword('');
        navigate('/admin');
        return;
      }
      await accessProject(projectPassword);
      // Reset form on success
      setProjectPassword('');
    } catch (error) {
      // Error is handled in the hook
    }
  };
const handleProjectCreated = (projectId: string, projectNumber: number) => {
  setCreateProjectOpen(false);
  toast({
    title: "Proyecto creado exitosamente",
    description: `Proyecto número ${projectNumber} creado. Puedes acceder a él ahora.`,
  });
};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white border-gray-200">
        <div className="container mx-auto px-4 py-3">
          {/* Desktop Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {currentProject?.logo_url ? (
                <img 
                  src={currentProject.logo_url} 
                  alt={`${currentProject.name} logo`}
                  className="h-10 max-w-[160px] w-auto object-contain"
                />
              ) : (
                <img 
                  src={vecturaLogo} 
                  alt="Vectura" 
                  className="h-10 w-auto object-contain"
                />
              )}
              <h1 className="text-2xl font-bold">
                {currentProject ? currentProject.name : 'Vectura'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut} aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

{/* Main Content */}
      <main className="container mx-auto px-4 py-6 pt-20">
        {!currentProject ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {!showProjectsList ? (
              <>
                {/* Mis Proyectos */}
                <Card>
                  <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                      <img 
                        src={vecturaLogo} 
                        alt="Vectura" 
                        className="h-16 w-auto object-contain"
                      />
                    </div>
                    <div>
                      <CardTitle>Mis Proyectos</CardTitle>
                      <CardDescription>
                        Selecciona un proyecto al que tienes acceso
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button 
                        onClick={async () => {
                          setShowProjectsList(true);
                          await fetchUserProjects();
                        }}
                        disabled={loadingProjects}
                        className="w-full"
                      >
                        {loadingProjects ? 'Cargando proyectos...' : 'Ver mis proyectos'}
                      </Button>
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            O accede con contraseña
                          </span>
                        </div>
                      </div>

                      <form onSubmit={handleProjectAccess} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="project-password">Contraseña del Proyecto</Label>
                          <Input
                            id="project-password"
                            type="password"
                            value={projectPassword}
                            onChange={(e) => setProjectPassword(e.target.value)}
                            placeholder="Introduce la contraseña del proyecto"
                            required
                          />
                        </div>
                        <Button type="submit" disabled={isAccessing} className="w-full" variant="outline">
                          {isAccessing ? 'Accediendo...' : 'Acceder con contraseña'}
                        </Button>
                      </form>
                      
                      <div className="text-center">
                        <Button variant="ghost" onClick={() => setCreateProjectOpen(true)}>
                          Crear nuevo proyecto
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Proyectos Disponibles</CardTitle>
                      <CardDescription>
                        Haz clic en un proyecto para acceder directamente
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setShowProjectsList(false)}>
                      Volver
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {userProjects.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No tienes acceso a ningún proyecto aún
                      </p>
                      <Button onClick={() => setCreateProjectOpen(true)}>
                        Crear tu primer proyecto
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {userProjects.map((project) => (
                        <Card 
                          key={project.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => accessProjectDirectly(project)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                              {project.logo_url ? (
                                <img 
                                  src={project.logo_url} 
                                  alt={`${project.name} logo`}
                                  className="h-8 w-8 object-contain"
                                />
                              ) : (
                                <div className="h-8 w-8 bg-primary/20 rounded flex items-center justify-center">
                                  <span className="text-xs font-bold">
                                    {project.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div>
                                <CardTitle className="text-lg">{project.name}</CardTitle>
                                <CardDescription>
                                  Proyecto #{project.project_number}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Create Project Modal */}
            <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear nuevo proyecto</DialogTitle>
                  <DialogDescription>Completa la información del proyecto</DialogDescription>
                </DialogHeader>
                <CreateProjectForm
                  onProjectCreated={handleProjectCreated}
                  onClose={() => setCreateProjectOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <SidebarProvider>
            <div className="min-h-screen flex w-full pt-16">
              <AppSidebar currentProject={currentProject} />
              <SidebarInset className="flex-1">
                <main className="flex-1 p-6">
                  <Routes>
                    <Route path="/" element={<Navigate to="tasks" replace />} />
                    <Route path="tasks" element={<IncidentsModule projectId={currentProject.id} />} />
                    <Route path="dailies" element={<DailiesModule projectId={currentProject.id} initiallyUnlocked />} />
                    <Route path="vacations" element={<VacationsModule projectId={currentProject.id} />} />
                    <Route path="users" element={<UsersModule projectId={currentProject.id} />} />
                    <Route path="notes" element={<NotesModule projectId={currentProject.id} />} />
                    <Route path="settings" element={<ProjectSettingsModule projectId={currentProject.id} />} />
                  </Routes>
                </main>
              </SidebarInset>
            </div>
          </SidebarProvider>
        )}
      </main>
    </div>
  );
};

export default Dashboard;