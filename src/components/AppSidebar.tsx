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
  AlertTriangle,
  Home
} from 'lucide-react';

interface AppSidebarProps {
  currentProject: any;
}

const menuItems = [
  { 
    title: "Home", 
    url: "home", 
    icon: Home,
    description: "Resumen del proyecto" 
  },
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
    <aside 
      className="fixed left-0 top-[75px] w-16 h-[calc(100vh-75px)] bg-background border-r border-border shadow-sm overflow-y-auto z-40"
      data-sidebar="content"
    >
      <div className="p-2">
        <nav className="flex flex-col items-center gap-4">
          <TooltipProvider>
            {menuItems.map((item) => (
              <div key={item.title}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) => 
                        `group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary' 
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground hover:shadow-sm'
                        }`
                      }
                    >
                      <item.icon className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="ml-2">
                    <div className="flex flex-col">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </TooltipProvider>
        </nav>
      </div>
    </aside>
  );
}