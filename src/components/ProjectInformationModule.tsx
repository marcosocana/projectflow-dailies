import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
interface ProjectInformationModuleProps {
  projectId: string;
}

export default function ProjectInformationModule({ projectId }: ProjectInformationModuleProps) {
  const { currentProject } = useProjectAccess();
  const { toast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPass, setResetPass] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPass !== 'Resete0') {
      toast({ title: 'Contraseña incorrecta', description: 'Introduce la contraseña de Admin', variant: 'destructive' });
      return;
    }
    setResetting(true);
    try {
      // Eliminar historiales de notas vinculados
      const { data: noteIds } = await supabase.from('shared_notes').select('id').eq('project_id', projectId);
      if (noteIds && noteIds.length) {
        await supabase.from('shared_notes_history').delete().in('note_id', noteIds.map((n: any) => n.id));
      }
      // Eliminar comentarios de incidencias
      const { data: incidentIds } = await supabase.from('incidents').select('id').eq('project_id', projectId);
      if (incidentIds && incidentIds.length) {
        await supabase.from('incident_comments').delete().in('incident_id', incidentIds.map((i: any) => i.id));
      }
      // Eliminar relaciones daily_tasks por daily y por task
      const { data: dailyIds } = await supabase.from('dailies').select('id').eq('project_id', projectId);
      if (dailyIds && dailyIds.length) {
        await supabase.from('daily_tasks').delete().in('daily_id', dailyIds.map((d: any) => d.id));
      }
      const { data: taskIds } = await supabase.from('tasks').select('id').eq('project_id', projectId);
      if (taskIds && taskIds.length) {
        await supabase.from('daily_tasks').delete().in('task_id', taskIds.map((t: any) => t.id));
      }
      // Eliminar tablas principales
      await supabase.from('tasks').delete().eq('project_id', projectId);
      await supabase.from('dailies').delete().eq('project_id', projectId);
      await supabase.from('incidents').delete().eq('project_id', projectId);
      await supabase.from('shared_notes').delete().eq('project_id', projectId);
      await supabase.from('vacations').delete().eq('project_id', projectId);
      await supabase.from('people').delete().eq('project_id', projectId);

      toast({ title: 'Sistema reseteado', description: 'Se eliminó todo el contenido del proyecto.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo resetear el proyecto', variant: 'destructive' });
    } finally {
      setResetting(false);
      setResetOpen(false);
      setResetPass('');
    }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {currentProject?.logo_url && (
              <img 
                src={currentProject.logo_url} 
                alt={`Logo de ${currentProject.name}`}
                className="h-12 w-auto object-contain border rounded"
              />
            )}
            <CardTitle>{currentProject?.name || 'Información del Proyecto'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">Versión</h3>
            <Input value="V.1.0.0" disabled className="bg-muted" />
          </section>

          <section className="space-y-2">
            <h3 className="text-lg font-semibold">Datos de soporte</h3>
            <div className="flex items-start justify-between gap-4 p-4 border rounded">
              <div>
                <p className="font-medium">Marcos Ocaña Talavera</p>
                <p className="text-sm text-muted-foreground">mocanat@minsait.com</p>
                <p className="text-sm text-muted-foreground">Contacta por Teams o email</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="secondary">
                  <a href="https://teams.microsoft.com/l/chat/0/0?users=mocanat@minsait.com" target="_blank" rel="noreferrer">Contactar por Teams</a>
                </Button>
                <Button asChild>
                  <a href="mailto:mocanat@minsait.com">Contactar por email</a>
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Acciones</h3>
            <Button variant="destructive" onClick={() => setResetOpen(true)}>
              Resetar sistema
            </Button>
          </section>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
            <DialogDescription>
              Esta acción borrará todo el contenido del proyecto. Para continuar, introduce la contraseña de Admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-pass">Contraseña</Label>
              <Input id="reset-pass" type="password" value={resetPass} onChange={(e) => setResetPass(e.target.value)} placeholder="Introduce la contraseña" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetting}>
                {resetting ? 'Reseteando...' : 'Confirmar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}