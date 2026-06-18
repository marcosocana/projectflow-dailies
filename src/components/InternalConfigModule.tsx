import DailiesModule from '@/components/DailiesModule';

interface InternalConfigModuleProps {
  projectId: string;
  dailiesPassword: string;
}

export default function InternalConfigModule({ projectId }: InternalConfigModuleProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Seguimiento</h1>
      </div>

      <DailiesModule projectId={projectId} initiallyUnlocked={true} enableResolvedYesterday={true} />
    </div>
  );
}
