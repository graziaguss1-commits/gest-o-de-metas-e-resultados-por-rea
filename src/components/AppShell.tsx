import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, ChevronRight } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/AppSidebar";
import { LancarResultadoModal } from "@/components/metas/LancarResultadoModal";
import { NotificationsDrawer } from "@/components/NotificationsDrawer";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  metas: "Minhas Metas",
  analise: "Análise de Saúde",
  planos: "Planos de Ação",
  relatorios: "Relatórios",
  ajuda: "Ajuda",
  configuracoes: "Configurações",
};

function buildBreadcrumb(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard", href: "/dashboard" }];
  const crumbs: { label: string; href: string }[] = [];
  let href = "";
  for (const seg of segments) {
    href += `/${seg}`;
    const label = ROUTE_LABELS[seg] ?? (seg.length > 20 ? `${seg.slice(0, 8)}…` : seg);
    crumbs.push({ label, href });
  }
  return crumbs;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [lancarOpen, setLancarOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const crumbs = buildBreadcrumb(pathname);

  return (
    <SidebarProvider style={{ ["--sidebar-width" as string]: "var(--sidebar-w, 232px)" }}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar onLancarResultado={() => setLancarOpen(true)} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="-ml-1" />
              <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="breadcrumb">
                {crumbs.map((c, i) => (
                  <span key={c.href} className="flex items-center gap-1 min-w-0">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {i === crumbs.length - 1 ? (
                      <span className="font-semibold text-foreground truncate">{c.label}</span>
                    ) : (
                      <Link
                        to={c.href}
                        className="text-muted-foreground hover:text-foreground truncate"
                      >
                        {c.label}
                      </Link>
                    )}
                  </span>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                title="Notificações"
                onClick={() => setNotifsOpen(true)}
              >
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </div>
      </div>

      <LancarResultadoModal open={lancarOpen} onOpenChange={setLancarOpen} />
      <NotificationsDrawer open={notifsOpen} onOpenChange={setNotifsOpen} />
    </SidebarProvider>
  );
}
