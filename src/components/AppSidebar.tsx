import { useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { 
  Calendar,
  Users,
  FileText,
  Settings,
  ClipboardList,
  BookOpen,
  AlertTriangle
} from 'lucide-react';

interface AppSidebarProps {
  currentProject: any;
}

const menuItems = [
  { 
    title: "Tareas", 
    url: "/tasks", 
    icon: ClipboardList,
    description: "Gestión de incidencias y tareas" 
  },
  { 
    title: "Dailies", 
    url: "/dailies", 
    icon: BookOpen,
    description: "Seguimiento diario del proyecto" 
  },
  { 
    title: "Vacaciones", 
    url: "/vacations", 
    icon: Calendar,
    description: "Gestión de vacaciones del equipo" 
  },
  { 
    title: "Usuarios", 
    url: "/users", 
    icon: Users,
    description: "Gestión de miembros del equipo" 
  },
  { 
    title: "Notas", 
    url: "/notes", 
    icon: FileText,
    description: "Notas compartidas del proyecto" 
  },
  { 
    title: "Configuración", 
    url: "/settings", 
    icon: Settings,
    description: "Configuración del proyecto" 
  },
];

export function AppSidebar({ currentProject }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar
      className={state === "collapsed" ? "w-14" : "w-60"}
      collapsible="icon"
    >
      <div className="p-4">
        <SidebarTrigger className="mb-4" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {currentProject?.name || 'Vectura'}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) =>
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                          : "hover:bg-sidebar-accent/50"
                      }
                      title={state === "collapsed" ? item.description : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}