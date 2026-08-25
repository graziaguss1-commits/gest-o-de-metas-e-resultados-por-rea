import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings, useUpdateAppSettings } from "@/hooks/useAppSettings";
import { formatTotalHoras } from "@/lib/agenda";
import { toast } from "sonner";

export default function GeneralSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
  });
  const { data: settings } = useAppSettings();
  const updateSettings = useUpdateAppSettings();
  const [capacidade, setCapacidade] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      company: profile.company ?? "",
    });
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (settings) setCapacidade(String(settings.capacidade_diaria_minutos ?? 480));
  }, [settings]);

  const salvarCapacidade = async () => {
    const min = Number(capacidade);
    if (!Number.isFinite(min) || min < 30 || min > 1440) {
      toast.error("Informe entre 30 e 1440 minutos.");
      return;
    }
    try {
      await updateSettings.mutateAsync({ capacidade_diaria_minutos: Math.round(min) });
      toast.success("Capacidade diária atualizada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a capacidade.",
      );
    }
  };

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Não foi possível salvar as alterações.");
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    toast.success("Informações atualizadas com sucesso.");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Informações pessoais</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={handleChange("full_name")}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                readOnly
                disabled
                className="cursor-not-allowed opacity-70"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={handleChange("phone")}
                placeholder="(11) 99999-9999"
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={form.company}
                onChange={handleChange("company")}
                maxLength={120}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Capacidade da agenda</CardTitle>
          <CardDescription>
            Quanto tempo por dia você tem disponível para executar seus planos. Usamos isso para avisar
            sobre sobrecarga no calendário e no planejamento semanal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="capacidade">Minutos por dia</Label>
            <Input
              id="capacidade"
              type="number"
              min={30}
              max={1440}
              step={15}
              className="w-[140px]"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
            />
          </div>
          <p className="pb-2 text-sm text-muted-foreground">
            Equivale a {formatTotalHoras(Number(capacidade) || 0)} por dia.
          </p>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={salvarCapacidade} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar capacidade
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
