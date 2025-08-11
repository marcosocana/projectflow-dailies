import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { 
  Calendar,
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
    title: "Incidencias", 
    url: "tasks", 
    icon: AlertTriangle,
    description: "Gestión de incidencias y mejoras" 
  },
  { 
    title: "Dailies", 
    url: "dailies", 
    icon: ClipboardList,
    description: "Gestión diaria de tareas y equipo" 
  },
  { 
    title: "Vacaciones", 
    url: "vacations", 
    icon: Calendar,
    description: "Gestión de vacaciones del equipo" 
  },
  { 
    title: "Notas", 
    url: "notes", 
    icon: FileText,
    description: "Notas compartidas del proyecto" 
  },
  { 
    title: "Configuración", 
    url: "settings", 
    icon: Settings,
    description: "Configuración del proyecto" 
  },
];

export function AppSidebar({ currentProject }: AppSidebarProps) {
  return (
    <Sidebar variant="inset" collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-muted'
                        }`
                      }
                      title={item.description}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
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