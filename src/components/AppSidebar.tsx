import { NavLink, useLocation } from 'react-router-dom';
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
  AlertTriangle,
  Home,
  Settings
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
    title: "Configuración interna", 
    url: "config", 
    icon: Settings,
    description: "Dailies y gestión del equipo" 
  },
  { 
    title: "Información", 
    url: "info", 
    icon: Info,
    description: "Información del proyecto" 
  },
];

export function AppSidebar({ currentProject }: AppSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside 
      className="fixed left-0 top-[64px] w-16 h-[calc(100vh-64px)] bg-white border-r border-border shadow-sm overflow-y-auto z-40"
      data-sidebar="content"
    >
      <div className="p-2">
        <nav className="flex flex-col items-center gap-4">
          <TooltipProvider>
            {menuItems.map((item) => {
              const isActive = currentPath.includes(`/${item.url}`);
              
              return (
                <div key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink 
                        to={item.url} 
                        end 
                        className={
                          `group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
                            isActive 
                              ? 'bg-primary/10 text-primary shadow-sm backdrop-blur-sm border border-primary/20' 
                              : 'bg-white text-muted-foreground hover:text-foreground hover:bg-primary/5'
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
              );
            })}
          </TooltipProvider>
        </nav>
      </div>
    </aside>
  );
}
