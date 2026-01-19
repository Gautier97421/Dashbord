"use client"

import React from "react"

import {
  LayoutDashboard,
  Calendar,
  Sun,
  CheckSquare,
  FolderKanban,
  BarChart3,
  Settings,
  Zap,
  Moon,
  Dumbbell,
  BedDouble,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"

export type NavPage = "dashboard" | "calendar" | "routine" | "routine-night" | "missions" | "projects" | "sport" | "sleep" | "statistics" | "settings"

const navItems: { id: NavPage; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "calendar", label: "Calendrier", icon: Calendar },
  { id: "routine", label: "Routine matinale", icon: Sun },
  { id: "routine-night", label: "Routine du soir", icon: Moon },
  { id: "missions", label: "Missions", icon: CheckSquare },
  { id: "projects", label: "Projets", icon: FolderKanban },
  { id: "sport", label: "Sport & Nutrition", icon: Dumbbell },
  { id: "sleep", label: "Sommeil", icon: BedDouble },
  { id: "statistics", label: "Statistiques", icon: BarChart3 },
  { id: "settings", label: "Paramètres", icon: Settings },
]

interface AppSidebarProps {
  currentPage: NavPage
  onNavigate: (page: NavPage) => void
}

export function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg overflow-hidden w-16 h-16 shadow-md">
            <img
              src="/perso_grain.png"
              alt="Perso"
              className="scale-535 object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Bonjour, Gautier</span>
            <span className="text-xs text-muted-foreground">Votre assistant quotidien</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentPage === item.id}
                    onClick={() => onNavigate(item.id)}
                    tooltip={item.label}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* <SidebarFooter className="border-t border-sidebar-border p-4">

      </SidebarFooter> */}
    </Sidebar>
  )
}
