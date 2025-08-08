import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, ArrowLeft } from "lucide-react";

interface ProjectRow {
  id: string;
  name: string;
  project_number: number;
  project_password: string;
  dailies_password: string;
  created_at: string;
}

export default function AdminProjects() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,project_number,project_password,dailies_password,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: "No se pudieron cargar los proyectos", variant: "destructive" });
      return;
    }
    setProjects(data || []);
  };

  useEffect(() => { load(); }, []);

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast({ title: "Sin permisos", description: "No puedes eliminar este proyecto (requiere rol admin)", variant: "destructive" });
    } else {
      toast({ title: "Proyecto eliminado", description: "Se ha eliminado correctamente" });
      load();
    }
  };

  const filtered = projects.filter((p) =>
    [p.name, String(p.project_number), p.project_password, p.dailies_password]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/")} aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Admin de Proyectos</h1>
          </div>
          <div className="text-sm text-muted-foreground">{user?.email}</div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Listado de proyectos</CardTitle>
            <CardDescription>Visualiza y elimina proyectos (requiere rol admin)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm mb-4">
              <Label>Buscar</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, nº o contraseña" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contraseña proyecto</TableHead>
                  <TableHead>Contraseña dailies</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.project_number}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="font-mono text-sm">{p.project_password}</TableCell>
                    <TableCell className="font-mono text-sm">{p.dailies_password}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="icon" onClick={() => onDelete(p.id)} aria-label="Eliminar proyecto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Sin proyectos</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
