import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeamModule from '@/components/TeamModule';
import TimeTrackingModule from '@/components/TimeTrackingModule';
import CostsModule from '@/components/CostsModule';
import { useAuth } from '@/hooks/useAuth';

interface ConfigurationModuleProps {
  projectId: string;
}

export default function ConfigurationModule({ projectId }: ConfigurationModuleProps) {
  const { user } = useAuth();
  const canViewCosts = user?.email?.toLowerCase() === 'mocanat@minsait.com';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Imputaciones</h1>
      </div>

      <Tabs defaultValue="time" className="w-full">
        <TabsList className={`grid w-full ${canViewCosts ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <TabsTrigger value="time">Imputaciones</TabsTrigger>
          {canViewCosts && <TabsTrigger value="team">Gestión del equipo</TabsTrigger>}
          {canViewCosts && <TabsTrigger value="costs">Costes</TabsTrigger>}
        </TabsList>

        <TabsContent value="time" className="space-y-4">
          <TimeTrackingModule projectId={projectId} />
        </TabsContent>

        {canViewCosts && (
          <TabsContent value="team" className="space-y-4">
            <TeamModule projectId={projectId} />
          </TabsContent>
        )}

        {canViewCosts && (
          <TabsContent value="costs" className="space-y-4">
            <CostsModule projectId={projectId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
