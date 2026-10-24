"use client"

import React from "react"
import { signOut, useSession } from "next-auth/react"

import { Settings, LogOut } from "lucide-react"
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
import { useNavPrefs } from "@/lib/nav-prefs"
import { DynamicIcon } from "@/lib/icon-map"
import { clearTravelOffline } from "@/lib/travel/offline"

export type NavPage = "dashboard" | "calendar" | "routine" | "routine-morning" | "routine-night" | "missions" | "projects" | "sport" | "nutrition" | "sleep" | "notes" | "cuisine" | "statistics" | "settings" | "ai-agent" | "applications" | "validation" | "subscriptions" | "budget" | "wishlist" | "travel"

// A page key is either a built-in NavPage or a "custom:<id>" string
export type PageKey = NavPage | string

interface AppSidebarProps {
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
}

export function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  const { data: session } = useSession()
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || "Utilisateur"
  const { items } = useNavPrefs()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg overflow-hidden w-16 h-16 shadow-md">
            <img
              src="/images/perso_grain.png"
              alt="Perso"
              className="scale-535 object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" style={{ fontFamily: 'cursive' }}>Bonjour, {userName}</span>
            <span className="text-xs text-muted-foreground" style={{ fontFamily: 'cursive' }}>Votre assistant quotidien</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={currentPage === item.key || (item.key === "routine" && (currentPage === "routine-morning" || currentPage === "routine-night"))}
                    onClick={() => onNavigate(item.key)}
                    tooltip={item.label}
                  >
                    <DynamicIcon name={item.icon} className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Settings pinned at the end */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentPage === "settings"}
                  onClick={() => onNavigate("settings")}
                  tooltip="Paramètres"
                >
                  <Settings className="size-4" />
                  <span>Paramètres</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              // Les voyages gardés hors connexion ne restent pas sur l'appareil
              onClick={() => clearTravelOffline().finally(() => signOut({ callbackUrl: "/login" }))}
              tooltip="Se déconnecter"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              <span>Se déconnecter</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
