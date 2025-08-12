import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DailiesModule from '@/components/DailiesModule';
import TeamModule from '@/components/TeamModule';
import { Lock } from 'lucide-react';

interface InternalConfigModuleProps {
  projectId: string;
  dailiesPassword: string;
}

export default function InternalConfigModule({ projectId, dailiesPassword }: InternalConfigModuleProps) {
  const [password, setPassword] = useState('');
  const [hasAccess, setHasAccess] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === dailiesPassword) {
      setHasAccess(true);
    } else {
      alert('Contraseña incorrecta');
    }
  };

  if (!hasAccess) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Lock className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>Configuración Interna</CardTitle>
            <CardDescription>
              Esta sección requiere contraseña para acceder
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="config-password">Contraseña</Label>
                <Input 
                  id="config-password" 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Introduce la contraseña" 
                  required 
                />
              </div>
              <Button type="submit" className="w-full">
                Acceder
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuración Interna</h1>
      </div>

      <Tabs defaultValue="dailies" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dailies">Dailies</TabsTrigger>
          <TabsTrigger value="team">Gestión del Equipo</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dailies" className="space-y-4">
          <DailiesModule projectId={projectId} />
        </TabsContent>
        
        <TabsContent value="team" className="space-y-4">
          <TeamModule projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}