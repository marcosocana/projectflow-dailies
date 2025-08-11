import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Calendar,
  FileText,
  Info,
  ClipboardList,
  Users,
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
    description: "Gestión diaria de tareas" 
  },
  { 
    title: "Equipo", 
    url: "team", 
    icon: Users,
    description: "Gestión del equipo del proyecto" 
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
    title: "Información", 
    url: "info", 
    icon: Info,
    description: "Información del proyecto" 
  },
];

export function AppSidebar({ currentProject }: AppSidebarProps) {
  return (
    <Sidebar 
      variant="sidebar" 
      collapsible="none" 
      className="border-r border-gray-200 bg-white"
      style={{ width: '60px' }}
    >
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink 
                            to={item.url} 
                            end 
                            className={({ isActive }) => 
                              `flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                                isActive 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                              }`
                            }
                          >
                            <item.icon className="h-5 w-5" />
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="ml-2">
                        <p>{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}