import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import CreateProjectForm from '@/components/CreateProjectForm';
import IncidentsModule from '@/components/IncidentsModule';
import DailiesModule from '@/components/DailiesModule';
import { LogOut } from 'lucide-react';

const Dashboard = () => {
  const [projectPassword, setProjectPassword] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [tab, setTab] = useState<'tareas' | 'dailies'>('tareas');
  const [dailiesOpen, setDailiesOpen] = useState(false);
  const [dailiesPass, setDailiesPass] = useState('');
  const [dailiesUnlocked, setDailiesUnlocked] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { accessProject, accessDailies, currentProject, isAccessing } = useProjectAccess();

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
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {currentProject?.logo_url && (
              <img 
                src={currentProject.logo_url} 
                alt={`${currentProject.name} logo`}
                className="h-8 w-8 object-contain"
              />
            )}
            <h1 className="text-2xl font-bold">
              {currentProject ? currentProject.name : 'ProjectFlow Dailies'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

{/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!currentProject ? (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Project Access */}
            <Card>
              <CardHeader>
                <CardTitle>Acceder a Proyecto</CardTitle>
                <CardDescription>
                  Introduce la contraseña del proyecto para acceder
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  <Button type="submit" disabled={isAccessing} className="w-full">
                    {isAccessing ? 'Accediendo...' : 'Acceder al Proyecto'}
                  </Button>
                </form>
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => setCreateProjectOpen(true)}>
                    Crear nuevo proyecto
                  </Button>
                </div>
              </CardContent>
            </Card>

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
          <div className="space-y-6">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as any); if (v === 'dailies' && !dailiesUnlocked) setDailiesOpen(true); }}>
              <TabsList>
                <TabsTrigger value="tareas">Tareas</TabsTrigger>
                <TabsTrigger value="dailies">Dailies</TabsTrigger>
              </TabsList>

              <TabsContent value="tareas">
                <IncidentsModule projectId={currentProject.id} />
              </TabsContent>

              <TabsContent value="dailies">
                {dailiesUnlocked ? (
                  <DailiesModule projectId={currentProject.id} initiallyUnlocked />
                ) : (
                  <div className="p-6 text-center text-muted-foreground">Introduce la contraseña para acceder a Dailies.</div>
                )}
              </TabsContent>
            </Tabs>

            {/* Dailies Password Modal */}
            <Dialog open={dailiesOpen} onOpenChange={setDailiesOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Acceder a Dailies</DialogTitle>
                  <DialogDescription>Introduce la contraseña de dailies</DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!currentProject) return;
                    try {
                      await accessDailies(currentProject.id, dailiesPass);
                      setDailiesUnlocked(true);
                      setDailiesOpen(false);
                      setDailiesPass('');
                    } catch {}
                  }}
                  className="space-y-4"
                >
                  <Input
                    type="password"
                    placeholder="Contraseña de dailies"
                    value={dailiesPass}
                    onChange={(e) => setDailiesPass(e.target.value)}
                    required
                  />
                  <Button type="submit">Acceder</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;