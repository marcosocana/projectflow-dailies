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
import DailiesModule from '@/components/DailiesModule';
import VacationsCalendarModule from '@/components/VacationsCalendarModule';
import NotesModule from '@/components/NotesModule';
import ProjectInformationModule from '@/components/ProjectInformationModule';
import TeamModule from '@/components/TeamModule';
import HomeModule from '@/components/HomeModule';
import { AppSidebar } from '@/components/AppSidebar';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import vecturaLogo from '@/assets/vectura-logo.png';

const Dashboard = () => {
  const [projectPassword, setProjectPassword] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const {
    accessProject,
    currentProject,
    isAccessing,
  } = useProjectAccess();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {currentProject?.logo_url ? (
               <img 
  src={currentProject.logo_url} 
  alt={`${currentProject.name} logo`} 
  className="h-10 max-w-[160px] w-auto object-contain absolute left-[10px]" 
/>
              ) : (
                <img src={vecturaLogo} alt="Vectura" className="h-10 w-auto object-contain" />
              )}
             <h1 className="text-2xl font-bold ml-[10px]">
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
      <main className="container mx-auto pt-0 py-[30px] px-0">
        {!currentProject ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Acceso con contraseña */}
            <Card>
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <img src={vecturaLogo} alt="Vectura" className="h-16 w-auto object-contain" />
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
            <main className="ml-16 p-6 pt-[88px]">
              <Routes>
                <Route path="/" element={<Navigate to="home" replace />} />
                <Route path="home" element={<HomeModule projectId={currentProject.id} />} />
                <Route path="tasks" element={<IncidentsModule projectId={currentProject.id} />} />
                <Route path="dailies" element={<DailiesModule projectId={currentProject.id} />} />
                <Route path="team" element={<TeamModule projectId={currentProject.id} />} />
                <Route path="vacations" element={<VacationsCalendarModule projectId={currentProject.id} />} />
                <Route path="notes" element={<NotesModule projectId={currentProject.id} />} />
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
