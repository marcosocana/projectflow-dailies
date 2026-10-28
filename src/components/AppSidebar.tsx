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
  Home,
  BarChart3,
  History,
  Rocket,
  Link,
  Users,
  Archive,
  User,
  Clock3,
  type LucideProps
} from 'lucide-react';

const UserClockIcon = ({ className }: LucideProps) => (
  <span className={`relative inline-flex ${className || ''}`} aria-hidden="true">
    <User className="h-full w-full" />
    <Clock3 className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-white" />
  </span>
);

const menuItems = [
  { 
    title: "Home", 
    url: "tasks", 
    icon: Home,
    description: "Gestión de incidencias y mejoras" 
  },
  { 
    title: "Seguimiento", 
    url: "config", 
    icon: BarChart3,
    description: "Seguimiento diario" 
  },
  {
    title: "Imputaciones",
    url: "imputaciones",
    icon: UserClockIcon,
    description: "Horas, equipo y costes"
  },
  { 
    title: "Actividad", 
    url: "activity", 
    icon: History,
    description: "Registro de cambios de incidencias" 
  },
  { 
    title: "Releases", 
    url: "releases", 
    icon: Rocket,
    description: "Registro de versiones Web y App" 
  },
  { 
    title: "Ausencias", 
    url: "vacations", 
    icon: Calendar,
    description: "Calendario de ausencias del equipo" 
  },
  { 
    title: "Repositorio", 
    url: "repository", 
    icon: Archive,
    description: "Archivos protegidos del proyecto" 
  },
  { 
    title: "Wiki", 
    url: "notes", 
    icon: FileText,
    description: "Notas compartidas del proyecto" 
  },
  { 
    title: "Contactos", 
    url: "contacts", 
    icon: Users,
    description: "Contactos destacados del proyecto" 
  },
  { 
    title: "Enlaces", 
    url: "links", 
    icon: Link,
    description: "Enlaces de interés del proyecto" 
  },
];

interface AppSidebarProps {
  currentProject: any;
  hasUnreadActivity: boolean;
}

export function AppSidebar({ currentProject, hasUnreadActivity }: AppSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside 
      className="hidden md:block fixed left-0 top-[64px] w-16 h-[calc(100vh-64px)] bg-white border-r border-border shadow-sm overflow-y-auto z-40"
      data-sidebar="content"
    >
      <div className="p-2">
        <nav className="flex flex-col items-center gap-4">
          <TooltipProvider>
            {menuItems.map((item) => {
              const isActive = currentPath.includes(`/${item.url}`);
              const showUnreadBullet = item.url === 'activity' && hasUnreadActivity && !isActive;
              
              return (
                <div key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink 
                        to={item.url} 
                        end 
                        className={
                          `group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
                            isActive 
                              ? 'bg-primary/10 text-primary shadow-sm backdrop-blur-sm border border-primary/20' 
                              : 'bg-white text-muted-foreground hover:text-foreground hover:bg-primary/5'
                          }`
                        }
                      >
                        <item.icon className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
                        {showUnreadBullet && (
                          <span
                            className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-white"
                            aria-label="Hay cambios nuevos en actividad"
                          />
                        )}
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="ml-2">
                      <div className="flex flex-col">
                        {item.title && <p className="font-medium">{item.title}</p>}
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
