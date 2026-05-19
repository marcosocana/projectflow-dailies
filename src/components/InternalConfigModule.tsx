import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DailiesModule from '@/components/DailiesModule';
import TeamModule from '@/components/TeamModule';

interface InternalConfigModuleProps {
  projectId: string;
  dailiesPassword: string;
}

export default function InternalConfigModule({ projectId }: InternalConfigModuleProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuración Interna</h1>
      </div>

      <Tabs defaultValue="dailies" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dailies">Seguimiento diario</TabsTrigger>
          <TabsTrigger value="team">Gestión del Equipo</TabsTrigger>
          <TabsTrigger value="excel">Excel incidencias</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dailies" className="space-y-4">
          <DailiesModule projectId={projectId} initiallyUnlocked={true} enableResolvedYesterday={true} />
        </TabsContent>
        
        <TabsContent value="team" className="space-y-4">
          <TeamModule projectId={projectId} />
        </TabsContent>
        
        <TabsContent value="excel" className="space-y-4">
          <iframe
            src="https://indra365-my.sharepoint.com/personal/mocanat_minsait_com/_layouts/15/Doc.aspx?sourcedoc={18ef93db-ea11-414e-aed3-6430382c3072}&action=embedview&wdAllowInteractivity=True&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True&edaebf=rslc0"
            title="Excel incidencias"
            frameBorder={0}
            scrolling="no"
            className="w-full h-[80vh] border rounded-md"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}