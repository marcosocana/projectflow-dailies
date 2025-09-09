import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import CreateProjectForm from '@/components/CreateProjectForm';
import IncidentsModule from '@/components/IncidentsModule';
import ReleasesModule from '@/components/ReleasesModule';
import InterestingLinksModule from '@/components/InterestingLinksModule';
import VacationsModule from '@/components/VacationsModule';
import NotesModule from '@/components/NotesModule';
import ProjectInformationModule from '@/components/ProjectInformationModule';
import ContactsModule from '@/components/ContactsModule';
import RepositoryModule from '@/components/RepositoryModule';
// import HomeModule from '@/components/HomeModule';
import InternalConfigModule from '@/components/InternalConfigModule';
import { AppSidebar } from '@/components/AppSidebar';
import NoteDetail from '@/components/NoteDetail';
import NoteCreate from '@/components/NoteCreate';
import ScrollToTop from '@/components/ScrollToTop';
import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import vecturaLogo from '@/assets/vectura-logo.png';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const Dashboard = () => {
  const [projectPassword, setProjectPassword] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const {
    accessProject,
    currentProject,
    isAccessing,
    leaveProject,
  } = useProjectAccess();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    leaveProject();
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

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white h-[64px] flex items-center">
        <div className="relative w-full h-full flex items-center justify-center px-3 md:px-6">
          {/* Bloque izquierdo: logo + título */}
          <div className="absolute left-2 md:left-[10px] flex items-center gap-2">
            {currentProject?.logo_url ? (
              <img
                src={currentProject.logo_url}
                alt={`${currentProject.name} logo`}
                className="h-8 md:h-10 w-auto object-contain"
              />
            ) : (
              <img
                src={vecturaLogo}
                alt="Vectorea"
                className="h-8 md:h-10 w-auto object-contain"
              />
            )}
            <h1 className="text-lg md:text-2xl font-bold">
              {currentProject ? currentProject.name : 'Vectorea'}
            </h1>
          </div>

          {/* Bloque derecho: menú móvil + email (oculto en móvil) + cerrar sesión */}
          <div className="absolute right-2 md:right-[15px] flex items-center gap-2 md:gap-4">
            {/* Menú hamburguesa en móvil */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
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
                    <a href="/config">Configuración interna</a>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href="/info">Información</a>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <span className="hidden md:inline text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </header>


      <main className="container mx-auto pt-[94px] py-0 px-0">
        {!currentProject ? (
          <div className="max-w-4xl mx-auto space-y-6 px-4 md:px-0">
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
          </div>
        ) : (
          <div className="min-h-screen">
            <AppSidebar currentProject={currentProject} />
            <main className="ml-0 md:ml-16 p-4 md:p-6 pt-[64px]">
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Navigate to="tasks" replace />} />
                <Route path="tasks" element={<IncidentsModule projectId={currentProject.id} />} />
                <Route path="releases" element={<ReleasesModule projectId={currentProject.id} />} />
                <Route path="vacations" element={<VacationsModule projectId={currentProject.id} />} />
                <Route path="repository" element={<RepositoryModule projectId={currentProject.id} />} />
                <Route path="notes" element={<NotesModule projectId={currentProject.id} />} />
                <Route path="notes/new" element={<NoteCreate projectId={currentProject.id} />} />
                <Route path="notes/:noteId" element={<NoteDetail projectId={currentProject.id} />} />
                <Route path="contacts" element={<ContactsModule projectId={currentProject.id} />} />
                <Route path="links" element={<InterestingLinksModule projectId={currentProject.id} />} />
                <Route path="config" element={<InternalConfigModule projectId={currentProject.id} dailiesPassword={(currentProject as any).dailies_password || 'default'} />} />
                <Route path="info" element={<ProjectInformationModule projectId={currentProject.id} />} />
              </Routes>
            </main>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
