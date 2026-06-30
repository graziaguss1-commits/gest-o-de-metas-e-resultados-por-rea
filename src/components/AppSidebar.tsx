import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  ListChecks,
  BarChart3,
  HelpCircle,
  Settings,
  Plus,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

export function AppSidebar({
  onLancarResultado,
}: {
  onLancarResultado?: () => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut, profile, isAdmin } = useAuth();

  const items: NavItem[] = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Minhas Metas", url: "/metas", icon: Target },
    { title: "Planos de Ação", url: "/planos", icon: ListChecks },
    { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  ];

  const footerItems: NavItem[] = [
    { title: "Ajuda", url: "/ajuda", icon: HelpCircle },
    { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: true },
  ];

  const visibleFooterItems = footerItems.filter((i) => !i.adminOnly || isAdmin);

  const visibleItems = items.filter((i) => !i.adminOnly || isAdmin);

  const initials = (profile?.full_name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const isActive = (url: string) =>
    url === "/dashboard"
      ? pathname === "/" || pathname === "/dashboard"
      : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="px-2 pt-4">
        {!collapsed && (
          <div className="px-3 mb-6 select-none">
            <div className="text-[hsl(var(--sidebar-foreground))] text-xl font-black tracking-tight leading-none">
              Metas<span style={{ color: "var(--color-blue-hover)" }}>IA</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]/55 mt-1">
              Gestão de metas & resultados
            </div>
          </div>
        )}

        {onLancarResultado && !collapsed && (
          <div className="px-3 mb-3">
            <Button
              size="sm"
              className="w-full justify-start gap-2 font-medium"
              style={{ backgroundColor: "var(--color-blue)", color: "white" }}
              onClick={onLancarResultado}
            >
              <Plus className="h-4 w-4" />
              Lançar resultado
            </Button>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={
                        active
                          ? "bg-[hsl(var(--sidebar-accent))] text-white relative before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r before:bg-[var(--color-blue-hover)]"
                          : "text-[hsl(var(--sidebar-foreground))]/85 hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-white"
                      }
                    >
                      <NavLink to={item.url} className="flex items-center gap-3 py-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <span className="text-sm font-medium">{item.title}</span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[hsl(var(--sidebar-border))] pt-3 pb-3">
        {visibleFooterItems.length > 0 && (
          <SidebarMenu className="mb-2">
            {visibleFooterItems.map((item) => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className={
                      active
                        ? "bg-[hsl(var(--sidebar-accent))] text-white relative before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r before:bg-[var(--color-blue-hover)]"
                        : "text-[hsl(var(--sidebar-foreground))]/85 hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-white"
                    }
                  >
                    <NavLink to={item.url} className="flex items-center gap-3 py-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="text-sm font-medium">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        )}
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: "var(--color-blue)" }}
            >
              {initials || "•"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[hsl(var(--sidebar-foreground))] truncate">
                {profile?.full_name || "Usuário"}
              </div>
              {isAdmin && (
                <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--sidebar-foreground))]/55">
                  Admin
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-7 w-7 text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="mx-auto h-8 w-8 text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
