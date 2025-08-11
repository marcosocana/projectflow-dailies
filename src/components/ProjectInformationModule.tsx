import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useProjectAccess } from '@/hooks/useProjectAccess';

interface ProjectInformationModuleProps {
  projectId: string;
}

export default function ProjectInformationModule({ projectId }: ProjectInformationModuleProps) {
  const { currentProject } = useProjectAccess();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Proyecto</CardTitle>
          <CardDescription>
            Información básica del proyecto (solo lectura)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Información básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información básica</h3>
            
            <div className="space-y-2">
              <Label>Nombre del proyecto</Label>
              <Input
                value={currentProject?.name || ''}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Número del proyecto</Label>
              <Input
                value={currentProject?.project_number || ''}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          {/* Logo del proyecto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Logo del proyecto</h3>
            
            {currentProject?.logo_url ? (
              <div className="flex items-center gap-4">
                <img 
                  src={currentProject.logo_url} 
                  alt="Logo del proyecto"
                  className="h-16 w-auto object-contain border rounded"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay logo configurado</p>
            )}
          </div>

          {/* Información adicional */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información adicional</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de versión</Label>
                <Input
                  value="V.1.0.0"
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Fecha de creación</Label>
                <Input
                  value={currentProject?.created_at ? new Date(currentProject.created_at).toLocaleDateString() : ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Última actualización</Label>
                <Input
                  value={currentProject?.updated_at ? new Date(currentProject.updated_at).toLocaleDateString() : ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}