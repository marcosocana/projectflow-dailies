import { useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Calendar, Users, FileText, Settings, ClipboardList, BookOpen, AlertTriangle } from 'lucide-react';
interface AppSidebarProps {
  currentProject: any;
}
const menuItems = [{
  title: "Tareas",
  url: "tasks",
  icon: ClipboardList,
  description: "Gestión de incidencias y tareas"
}, {
  title: "Dailies",
  url: "dailies",
  icon: BookOpen,
  description: "Seguimiento diario del proyecto"
}, {
  title: "Vacaciones",
  url: "vacations",
  icon: Calendar,
  description: "Gestión de vacaciones del equipo"
}, {
  title: "Usuarios",
  url: "users",
  icon: Users,
  description: "Gestión de miembros del equipo"
}, {
  title: "Notas",
  url: "notes",
  icon: FileText,
  description: "Notas compartidas del proyecto"
}, {
  title: "Configuración",
  url: "settings",
  icon: Settings,
  description: "Configuración del proyecto"
}];
export function AppSidebar({
  currentProject
}: AppSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  return <Sidebar className="w-14 bg-white border-r border-gray-200" collapsible="none">
      <SidebarContent className="bg-white">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={({
                  isActive
                }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium flex items-center justify-center" : "hover:bg-sidebar-accent/50 flex items-center justify-center"} title={item.description}>
                      <item.icon className="h-4 w-4" />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>;
}