import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Plus } from 'lucide-react';

const Dashboard = () => {
  const [projectNumber, setProjectNumber] = useState('');
  const [projectPassword, setProjectPassword] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente.",
    });
  };

  const handleProjectAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement project access logic
    toast({
      title: "Acceso a proyecto",
      description: `Accediendo al proyecto ${projectNumber}...`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">ProjectFlow Dailies</h1>
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
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Project Access */}
          <Card>
            <CardHeader>
              <CardTitle>Acceder a Proyecto</CardTitle>
              <CardDescription>
                Introduce el número de proyecto y contraseña para acceder
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProjectAccess} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-number">Número de Proyecto</Label>
                  <Input
                    id="project-number"
                    type="number"
                    value={projectNumber}
                    onChange={(e) => setProjectNumber(e.target.value)}
                    placeholder="Ej: 1001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-password">Contraseña del Proyecto</Label>
                  <Input
                    id="project-password"
                    type="password"
                    value={projectPassword}
                    onChange={(e) => setProjectPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Acceder al Proyecto
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Create New Project */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Crear Nuevo Proyecto
              </CardTitle>
              <CardDescription>
                Crea un nuevo proyecto para compartir con tu equipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowCreateProject(!showCreateProject)}
                variant="outline"
                className="w-full"
              >
                {showCreateProject ? 'Ocultar' : 'Crear Proyecto'}
              </Button>
              
              {showCreateProject && (
                <div className="mt-4 p-4 border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Funcionalidad de creación de proyectos próximamente...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;