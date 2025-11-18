import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TaskAssignmentsInput, { type TaskAssignment } from './TaskAssignmentsInput';
import { Checkbox } from '@/components/ui/checkbox';
import type { Database } from '@/integrations/supabase/types';

type IncidentCategory = Database['public']['Enums']['incident_category'];

interface ParsedRow {
  number: string;
  epic: string;
  category: string;
  name: string;
  description: string;
}

interface BacklogImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  teamMembers: Array<{ id: string; name: string; color: string }>;
  onImportComplete: () => void;
}

export default function BacklogImportDialog({
  open,
  onOpenChange,
  projectId,
  teamMembers,
  onImportComplete
}: BacklogImportDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'paste' | 'confirm'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [createDailyTasks, setCreateDailyTasks] = useState(true);
  const [processing, setProcessing] = useState(false);

  const resetDialog = () => {
    setStep('paste');
    setPastedText('');
    setParsedRows([]);
    setCurrentIndex(0);
    setAssignments([]);
    setCreateDailyTasks(true);
    setProcessing(false);
  };

  const handleParse = () => {
    const lines = pastedText.trim().split('\n');
    const rows: ParsedRow[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Split by tab or multiple spaces
      const columns = line.split(/\t+|\s{2,}/);
      
      if (columns.length >= 5) {
        const number = columns[0]?.trim() || '';
        const name = columns[3]?.trim() || '';
        const nameWithNumber = number ? `${name} [${number}]` : name;
        
        rows.push({
          number,
          epic: columns[1]?.trim() || '',
          category: columns[2]?.trim() || '',
          name: nameWithNumber,
          description: columns[4]?.trim() || ''
        });
      }
    }

    if (rows.length === 0) {
      toast({
        title: 'Error al parsear',
        description: 'No se encontraron filas válidas. Asegúrate de que cada fila tenga al menos 5 columnas separadas por tabulaciones.',
        variant: 'destructive'
      });
      return;
    }

    setParsedRows(rows);
    setCurrentIndex(0);
    setAssignments([]);
    setStep('confirm');
  };

  const mapCategory = (categoryText: string): IncidentCategory => {
    const normalized = categoryText.toLowerCase().trim();
    if (normalized.includes('incidencia') || normalized.includes('incident')) {
      return 'incident';
    }
    if (normalized.includes('mejora') || normalized.includes('improvement')) {
      return 'improvement';
    }
    return 'incident'; // Default
  };

  const handleCreateCurrent = async () => {
    if (processing) return;
    
    const current = parsedRows[currentIndex];
    if (!current) return;

    setProcessing(true);

    try {
      // Create incident
      const { data: incident, error: incidentError } = await supabase
        .from('incidents')
        .insert({
          project_id: projectId,
          name: current.name,
          description: current.description || null,
          epic: current.epic || null,
          category: mapCategory(current.category),
          status: 'pending',
          occurred_at: new Date().toISOString()
        })
        .select()
        .single();

      if (incidentError) throw incidentError;

      // Create assignments
      if (assignments.length > 0) {
        const assignmentInserts = assignments.map(assignment => ({
          incident_id: incident.id,
          assigned_to: assignment.person,
          status: assignment.status
        }));

        const { error: assignError } = await supabase
          .from('incident_assignments')
          .insert(assignmentInserts);

        if (assignError) throw assignError;

        // Create daily tasks if requested
        if (createDailyTasks) {
          const today = new Date().toISOString().split('T')[0];
          
          // Get or create today's daily
          let dailyId: string;
          const { data: existingDaily } = await supabase
            .from('dailies')
            .select('id')
            .eq('project_id', projectId)
            .eq('date', today)
            .single();

          if (existingDaily) {
            dailyId = existingDaily.id;
          } else {
            const { data: newDaily, error: dailyError } = await supabase
              .from('dailies')
              .insert({
                project_id: projectId,
                date: today,
                content: {}
              })
              .select()
              .single();

            if (dailyError) throw dailyError;
            dailyId = newDaily.id;
          }

          // Create tasks for each assignment
          const taskInserts = assignments.map(assignment => ({
            project_id: projectId,
            person_id: assignment.person,
            title: current.name,
            description: current.description || null,
            status: 'pending' as const,
            incident_id: incident.id,
            is_auto_linked: true
          }));

          const { data: createdTasks, error: taskError } = await supabase
            .from('tasks')
            .insert(taskInserts)
            .select();

          if (taskError) throw taskError;

          // Link tasks to daily
          const dailyTaskInserts = createdTasks.map(task => ({
            daily_id: dailyId,
            task_id: task.id
          }));

          const { error: dailyTaskError } = await supabase
            .from('daily_tasks')
            .insert(dailyTaskInserts);

          if (dailyTaskError) throw dailyTaskError;
        }
      }

      toast({
        title: 'Tarea creada',
        description: `"${current.name}" ha sido creada correctamente`
      });

      // Move to next or finish
      if (currentIndex < parsedRows.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setAssignments([]);
      } else {
        // Finished all rows
        toast({
          title: 'Importación completada',
          description: `Se han importado ${parsedRows.length} tareas correctamente`
        });
        onImportComplete();
        onOpenChange(false);
        resetDialog();
      }
    } catch (error: any) {
      console.error('Error creating incident:', error);
      toast({
        title: 'Error al crear la tarea',
        description: error.message || 'Ha ocurrido un error',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSkipCurrent = () => {
    if (currentIndex < parsedRows.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAssignments([]);
    } else {
      // Finished (skipped last one)
      toast({
        title: 'Importación completada',
        description: 'Proceso de importación finalizado'
      });
      onImportComplete();
      onOpenChange(false);
      resetDialog();
    }
  };

  const currentRow = parsedRows[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetDialog();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'paste' ? 'Importar desde Backlog' : `Confirmar tarea (${currentIndex + 1}/${parsedRows.length})`}
          </DialogTitle>
          <DialogDescription>
            {step === 'paste' 
              ? 'Pega la información del backlog con la siguiente estructura: Número | Épica | Categoría | Nombre | Descripción'
              : 'Revisa los datos y asigna personas antes de crear la tarea'}
          </DialogDescription>
        </DialogHeader>

        {step === 'paste' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pegar información del backlog</Label>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="756    Planificación del mantenimiento    Incidencia    WEB/PRO: El filtro de fecha planificada no funciona, lo muestra todo    Descripción detallada&#10;757    Gestión de usuarios    Mejora    Añadir filtros avanzados en el listado    Descripción de la mejora&#10;..."
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Cada fila debe tener 5 columnas separadas por tabulaciones o múltiples espacios
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleParse} disabled={!pastedText.trim()}>
                Procesar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {currentRow && (
              <>
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Épica</Label>
                      <p className="text-sm font-medium">{currentRow.epic || 'Sin épica'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoría</Label>
                      <Badge variant="outline" className="mt-1">
                        {currentRow.category}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                    <p className="text-sm font-medium">{currentRow.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Descripción</Label>
                    <p className="text-sm">{currentRow.description || 'Sin descripción'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Personas asignadas</Label>
                  <TaskAssignmentsInput
                    teamMembers={teamMembers}
                    assignments={assignments}
                    onAssignmentsChange={setAssignments}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="createDailyTasks"
                    checked={createDailyTasks}
                    onCheckedChange={(checked) => setCreateDailyTasks(checked as boolean)}
                  />
                  <Label htmlFor="createDailyTasks" className="text-sm font-normal cursor-pointer">
                    Crear tareas en el seguimiento diario
                  </Label>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    variant="ghost"
                    onClick={handleSkipCurrent}
                    disabled={processing}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Omitir
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetDialog();
                        onOpenChange(false);
                      }}
                      disabled={processing}
                    >
                      Cancelar todo
                    </Button>
                    <Button
                      onClick={handleCreateCurrent}
                      disabled={processing}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {processing ? 'Creando...' : 'Crear'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
