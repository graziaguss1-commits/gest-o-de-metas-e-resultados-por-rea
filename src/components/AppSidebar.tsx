import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, CalendarDays, CalendarCheck, HelpCircle, LayoutDashboard, Lightbulb, ListChecks, LogOut, Plus, Settings, Target } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

export function AppSidebar({ onLancarResultado }: { onLancarResultado?: () => void }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut, profile, isAdmin } = useAuth();
  const items: NavItem[] = [
    { title: "Visão geral", url: "/dashboard", icon: LayoutDashboard },
    { title: "Metas e objetivos", url: "/metas", icon: Target },
    { title: "Planos de ação", url: "/planos", icon: ListChecks },
    { title: "Impacto × esforço", url: "/acoes", icon: Lightbulb },
    { title: "Calendário", url: "/calendario", icon: CalendarDays },
    { title: "Planejar semana", url: "/planejamento-semanal", icon: CalendarCheck },
    { title: "Resultados", url: "/relatorios", icon: BarChart3 },
  ];
  const footerItems: NavItem[] = [
    { title: "Ajuda", url: "/ajuda", icon: HelpCircle },
    { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: true },
  ];
  const initials = (profile?.full_name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const isActive = (url: string) => url === "/dashboard" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(url);
  const menu = (entries: NavItem[]) => <SidebarMenu>{entries.filter((i) => !i.adminOnly || isAdmin).map((item) => {
    const active = isActive(item.url);
    return <SidebarMenuItem key={item.url}><SidebarMenuButton asChild isActive={active} tooltip={item.title} className={active ? "bg-white/10 text-white relative before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r before:bg-[var(--brand-accent)]" : "text-white/75 hover:bg-white/5 hover:text-white"}><NavLink to={item.url} className="flex items-center gap-3 py-2"><item.icon className="h-4 w-4 shrink-0" />{!collapsed && <span className="text-sm font-medium">{item.title}</span>}</NavLink></SidebarMenuButton></SidebarMenuItem>;
  })}</SidebarMenu>;

  return <Sidebar collapsible="icon" className="border-r-0">
    <SidebarContent className="px-2 pt-5">
      {!collapsed && <div className="px-3 mb-7 select-none"><div className="font-display text-xl font-semibold leading-none text-white">Painel de <span className="text-[var(--brand-accent)]">Performance</span></div><div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">Metas · execução · evolução</div></div>}
      {onLancarResultado && !collapsed && <div className="px-3 mb-3"><Button size="sm" className="brand-button w-full justify-start gap-2" onClick={onLancarResultado}><Plus className="h-4 w-4" />Lançar resultado</Button></div>}
      <SidebarGroup><SidebarGroupContent>{menu(items)}</SidebarGroupContent></SidebarGroup>
    </SidebarContent>
    <SidebarFooter className="border-t border-white/10 pt-3 pb-3">
      {menu(footerItems)}
      {!collapsed ? <div className="mt-2 flex items-center gap-2 px-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-xs font-bold text-white">{initials || "•"}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-white">{profile?.full_name || "Usuário"}</div>{isAdmin && <div className="text-[9px] uppercase tracking-wider text-white/45">Admin</div>}</div><Button variant="ghost" size="icon" onClick={signOut} className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white" title="Sair"><LogOut className="h-4 w-4" /></Button></div> : <Button variant="ghost" size="icon" onClick={signOut} className="mx-auto h-8 w-8 text-white/60 hover:bg-white/10 hover:text-white" title="Sair"><LogOut className="h-4 w-4" /></Button>}
    </SidebarFooter>
  </Sidebar>;
}
