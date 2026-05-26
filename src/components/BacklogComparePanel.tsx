import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCcw } from 'lucide-react';

type BacklogCompareRow = {
  id: string;
  type: string;
  excelStatus: string;
  vectoreaStatus: string;
};

type BacklogComparePanelProps = {
  projectId: string;
  onClose: () => void;
  onSelectId: (id: string) => void;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'WIP',
  in_qa: 'Resuelta',
  resolved: 'Resuelta',
  blocked: 'Block',
  closed: 'Cerrada',
};

const normalizeCompareId = (value: unknown) => String(value ?? '').trim().replace(/^INT/i, '').replace(/\D/g, '');

const normalizeText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const normalizeCategory = (value: string | null | undefined) => {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (normalized.includes('correctiva') || normalized.includes('corrective')) return 'corrective_improvement';
  if (normalized.includes('evolutivo') || normalized.includes('mejora') || normalized.includes('improvement')) return 'improvement';
  return 'incident';
};

const isComparisonMatch = (excelStatusRaw: string, vectoreaStatusRaw: string) => {
  const excel = normalizeText(excelStatusRaw);
  const vectorea = normalizeText(vectoreaStatusRaw);

  if (vectorea.includes('no existe en vectorea')) {
    return (
      excel.includes('cerrado') ||
      excel.includes('resuelto') ||
      excel.includes('descartado') ||
      excel.includes('bloqueado') ||
      excel.includes('en pruebas')
    );
  }

  if ((excel.includes('resuelto') || excel.includes('en pro')) && vectorea.includes('resuelta')) return true;
  if ((excel.includes('en pruebas') || excel.includes('en qa')) && vectorea.includes('resuelta')) return true;
  if (excel.includes('cerrado') && vectorea.includes('resuelta')) return true;
  if (excel.includes('cerrado') && vectorea.includes('cerrada')) return true;
  if (excel.includes('descartado') && vectorea.includes('resuelta')) return true;
  if (excel.includes('bloqueado') && vectorea.includes('resuelta')) return true;
  if (excel.includes('resuelto') && (vectorea.includes('resuelta') || vectorea.includes('en pro'))) return true;
  if (excel.includes('en pruebas') && (vectorea.includes('resuelta') || vectorea.includes('en pre') || vectorea.includes('en qa'))) return true;
  if (excel.includes('en curso') && vectorea.includes('wip')) return true;
  if (excel.includes('cerrado') && vectorea.includes('en pro')) return true;
  if (excel.includes('resuelto') && vectorea.includes('cerrada')) return true;
  if (excel.includes('descartado') && vectorea.includes('cerrada')) return true;
  if (excel.includes('descartado') && vectorea.includes('en pro')) return true;
  if (excel.includes('en pruebas') && vectorea.includes('en pro')) return true;

  return Boolean(excel && vectorea && (excel === vectorea || excel.includes(vectorea) || vectorea.includes(excel)));
};

function CompareTypeIcon({ type }: { type: string }) {
  if (!String(type ?? '').trim()) {
    return <span className="text-muted-foreground">-</span>;
  }
  const category = normalizeCategory(type);
  if (category === 'incident') {
    return <span title="Incidencia" className="inline-grid h-5 w-5 place-items-center rounded-sm bg-destructive text-[10px] font-bold text-destructive-foreground">I</span>;
  }
  if (category === 'corrective_improvement') {
    return <span title="Mejora correctiva" className="inline-grid h-5 w-5 place-items-center rounded-sm bg-purple-600 text-[10px] font-bold text-white">C</span>;
  }
  return <span title="Evolutivo" className="inline-grid h-5 w-5 place-items-center rounded-sm bg-primary text-[10px] font-bold text-primary-foreground">E</span>;
}

export default function BacklogComparePanel({ projectId, onClose, onSelectId }: BacklogComparePanelProps) {
  const { toast } = useToast();
  const compareInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BacklogCompareRow[]>([]);
  const [lastCompareFile, setLastCompareFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<{
    ids: string[];
    types: string[];
    excelStatuses: string[];
    vectoreaStatuses: string[];
  }>({
    ids: [],
    types: [],
    excelStatuses: [],
    vectoreaStatuses: [],
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['ID', 'Tipo', 'Estado']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_comparar_backlog.xlsx');
  };

  const compareWithFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const excelRows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Array<Record<string, unknown>>;

      const { data: incidents, error } = await supabase
        .from('incidents')
        .select('incident_number,status')
        .eq('project_id', projectId);
      if (error) throw error;

      const byId = new Map<string, any>();
      (incidents || []).forEach((incident: any) => {
        const id = normalizeCompareId(incident.incident_number);
        if (id) byId.set(id, incident);
      });

      const result = excelRows
        .map((row) => {
          const idRaw = row.ID ?? row.Id ?? row.id ?? '';
          const normalizedId = normalizeCompareId(idRaw);
          const incident = normalizedId ? byId.get(normalizedId) : null;
          return {
            id: String(idRaw || '').trim(),
            type: String(row.Tipo ?? row.tipo ?? '').trim(),
            excelStatus: String(row.Estado ?? row.estado ?? '').trim(),
            vectoreaStatus: incident ? (STATUS_LABELS[incident.status] || incident.status) : 'No existe en Vectorea',
          };
        })
        .filter((row) => row.id);

      setRows(result);
      setSelected({ ids: [], types: [], excelStatuses: [], vectoreaStatuses: [] });
      toast({
        title: 'Comparativa generada',
        description: `Se compararon ${result.length} filas.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo procesar el Excel de comparación',
        variant: 'destructive',
      });
    }
  };

  const filterOptions = useMemo(() => {
    const ids = Array.from(new Set(rows.map((row) => row.id))).sort((a, b) => Number(a) - Number(b));
    const types = Array.from(new Set(rows.map((row) => row.type || '-'))).sort();
    const excelStatuses = Array.from(new Set(rows.map((row) => row.excelStatus || '-'))).sort();
    const vectoreaStatuses = Array.from(new Set(rows.map((row) => row.vectoreaStatus || '-'))).sort();
    return { ids, types, excelStatuses, vectoreaStatuses };
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows
      .filter((row) => {
        const idValue = row.id;
        const typeValue = row.type || '-';
        const excelValue = row.excelStatus || '-';
        const vectoreaValue = row.vectoreaStatus || '-';
        return (
          (selected.ids.length === 0 || selected.ids.includes(idValue)) &&
          (selected.types.length === 0 || selected.types.includes(typeValue)) &&
          (selected.excelStatuses.length === 0 || selected.excelStatuses.includes(excelValue)) &&
          (selected.vectoreaStatuses.length === 0 || selected.vectoreaStatuses.includes(vectoreaValue))
        );
      })
      .sort((a, b) => {
        const aNum = Number(String(a.id).replace(/\D/g, ''));
        const bNum = Number(String(b.id).replace(/\D/g, ''));
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) return bNum - aNum;
        return String(b.id).localeCompare(String(a.id));
      });
  }, [rows, selected]);

  return (
    <Card className="sticky top-[88px] w-full shrink-0 self-start xl:w-[460px]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Comparar</CardTitle>
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}>Descargar plantilla</Button>
          <Button onClick={() => compareInputRef.current?.click()}>Subir excel</Button>
          <Button
            variant="outline"
            onClick={() => lastCompareFile && compareWithFile(lastCompareFile)}
            disabled={!lastCompareFile}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <input
            ref={compareInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setLastCompareFile(file);
                compareWithFile(file);
              }
              if (compareInputRef.current) compareInputRef.current.value = '';
            }}
          />
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2">ID</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-auto">
                      {filterOptions.ids.map((id) => (
                        <DropdownMenuCheckboxItem
                          key={id}
                          checked={selected.ids.includes(id)}
                          onCheckedChange={(checked) => setSelected((prev) => ({
                            ...prev,
                            ids: checked ? [...prev.ids, id] : prev.ids.filter((value) => value !== id),
                          }))}
                        >
                          {id}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead className="w-16">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2">Tipo</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-auto">
                      {filterOptions.types.map((type) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={selected.types.includes(type)}
                          onCheckedChange={(checked) => setSelected((prev) => ({
                            ...prev,
                            types: checked ? [...prev.types, type] : prev.types.filter((value) => value !== type),
                          }))}
                        >
                          {type}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2">Estado Excel</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-auto">
                      {filterOptions.excelStatuses.map((status) => (
                        <DropdownMenuCheckboxItem
                          key={status}
                          checked={selected.excelStatuses.includes(status)}
                          onCheckedChange={(checked) => setSelected((prev) => ({
                            ...prev,
                            excelStatuses: checked
                              ? [...prev.excelStatuses, status]
                              : prev.excelStatuses.filter((value) => value !== status),
                          }))}
                        >
                          {status}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2">Estado Vectorea</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-auto">
                      {filterOptions.vectoreaStatuses.map((status) => (
                        <DropdownMenuCheckboxItem
                          key={status}
                          checked={selected.vectoreaStatuses.includes(status)}
                          onCheckedChange={(checked) => setSelected((prev) => ({
                            ...prev,
                            vectoreaStatuses: checked
                              ? [...prev.vectoreaStatuses, status]
                              : prev.vectoreaStatuses.filter((value) => value !== status),
                          }))}
                        >
                          {status}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, index) => {
                const isMatch = isComparisonMatch(row.excelStatus || '', row.vectoreaStatus || '');
                return (
                  <TableRow
                    key={`${row.id}-${index}`}
                    className={isMatch ? 'bg-green-100 hover:bg-green-200/80' : 'bg-red-100 hover:bg-red-200/80'}
                  >
                    <TableCell>
                      <Button variant="link" className="h-auto p-0" onClick={() => onSelectId(row.id)}>
                        {row.id}
                      </Button>
                    </TableCell>
                    <TableCell><CompareTypeIcon type={row.type} /></TableCell>
                    <TableCell>{row.excelStatus || '-'}</TableCell>
                    <TableCell>{row.vectoreaStatus || '-'}</TableCell>
                  </TableRow>
                );
              })}
              {visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {rows.length === 0 ? 'Sube un archivo para ver la comparativa' : 'No hay filas para los filtros aplicados'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
