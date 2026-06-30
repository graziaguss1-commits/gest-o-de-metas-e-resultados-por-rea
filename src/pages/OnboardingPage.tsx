import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { CheckCircle2, Loader2, Target, Building2, Bell, User2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSaveSlackWebhook } from "@/hooks/useAppSettings";
import { useCreateMeta } from "@/hooks/useMetas";
import { AREAS, PERIODICIDADES, todayISO } from "@/lib/metas";

const STEPS = [
  { id: "profile", label: "Perfil", icon: User2 },
  { id: "company", label: "Empresa", icon: Building2 },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "meta", label: "Primeira meta", icon: Target },
  { id: "done", label: "Concluído", icon: Sparkles },
] as const;

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Informe seu nome completo").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

const companySchema = z.object({
  company: z.string().trim().min(1, "Informe o nome da empresa").max(120),
});

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCompleted, isLoading, completeOnboarding, markStepComplete } = useOnboarding();
  const saveSlack = useSaveSlackWebhook();
  const createMeta = useCreateMeta();

  const [stepIdx, setStepIdx] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [criarMeta, setCriarMeta] = useState(true);
  const [metaNome, setMetaNome] = useState("");
  const [metaArea, setMetaArea] = useState<string>(AREAS[0]);
  const [metaValor, setMetaValor] = useState("");
  const [metaUnidade, setMetaUnidade] = useState("R$");
  const [metaPeriod, setMetaPeriod] = useState("mensal");
  const [metaInicio, setMetaInicio] = useState(todayISO());
  const [metaFim, setMetaFim] = useState("");
  const [metaInverse, setMetaInverse] = useState(false);

  useEffect(() => {
    if (!isLoading && isCompleted) navigate("/dashboard", { replace: true });
  }, [isLoading, isCompleted, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, company")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const row = (data ?? {}) as { full_name?: string; phone?: string; company?: string };
      setFullName(row.full_name ?? "");
      setPhone(row.phone ?? "");
      setCompany(row.company ?? "");
      setLoadingProfile(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const goNext = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));

  const saveProfile = async () => {
    if (!user) return false;
    const parsed = profileSchema.safeParse({ full_name: fullName, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos.");
      return false;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar seus dados.");
      return false;
    }
    await markStepComplete("profile");
    return true;
  };

  const saveCompany = async () => {
    if (!user) return false;
    const parsed = companySchema.safeParse({ company });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos.");
      return false;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ company: parsed.data.company })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar a empresa.");
      return false;
    }
    await markStepComplete("company");
    return true;
  };

  const saveNotifications = async () => {
    const url = slackUrl.trim();
    if (url) {
      try {
        await saveSlack.mutateAsync(url);
        toast.success("Webhook do Slack configurado.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar webhook.");
        return false;
      }
    }
    await markStepComplete("notifications");
    return true;
  };

  const saveFirstMeta = async () => {
    if (!criarMeta) {
      await markStepComplete("meta");
      return true;
    }
    const valor = Number(metaValor.replace(",", "."));
    if (!metaNome.trim()) {
      toast.error("Informe o nome da meta.");
      return false;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Valor alvo precisa ser um número positivo.");
      return false;
    }
    if (!metaInicio || !metaFim) {
      toast.error("Defina as datas de início e fim.");
      return false;
    }
    if (metaFim < metaInicio) {
      toast.error("A data fim precisa ser posterior à de início.");
      return false;
    }
    try {
      await createMeta.mutateAsync({
        nome: metaNome.trim(),
        descricao: null,
        area: metaArea,
        responsavel_id: user?.id ?? null,
        valor_alvo: valor,
        valor_atual: 0,
        unidade: metaUnidade.trim() || "R$",
        periodicidade: metaPeriod as "mensal" | "trimestral" | "anual",
        data_inicio: metaInicio,
        data_fim: metaFim,
        is_inverse: metaInverse,
      });
      toast.success("Primeira meta criada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar meta.");
      return false;
    }
    await markStepComplete("meta");
    return true;
  };

  const handleNext = async () => {
    const id = STEPS[stepIdx].id;
    let ok = true;
    if (id === "profile") ok = await saveProfile();
    else if (id === "company") ok = await saveCompany();
    else if (id === "notifications") ok = await saveNotifications();
    else if (id === "meta") ok = await saveFirstMeta();
    if (ok) goNext();
  };

  const handleFinish = async () => {
    await completeOnboarding();
    toast.success("Tudo pronto! Bem-vindo ao MetasIA.");
    navigate("/dashboard", { replace: true });
  };

  const handleSkip = async () => {
    await completeOnboarding();
    navigate("/dashboard", { replace: true });
  };

  if (isLoading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando onboarding...
      </div>
    );
  }

  const current = STEPS[stepIdx];
  const isDone = current.id === "done";

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 mb-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === stepIdx;
              const done = i < stepIdx;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      done
                        ? "bg-[var(--color-blue)] text-white"
                        : active
                        ? "bg-[var(--color-blue-soft)] text-[var(--color-blue)] ring-2 ring-[var(--color-blue)]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider text-center ${
                      active ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          <CardTitle>
            {current.id === "profile" && "Seus dados"}
            {current.id === "company" && "Sobre sua empresa"}
            {current.id === "notifications" && "Notificações"}
            {current.id === "meta" && "Sua primeira meta"}
            {current.id === "done" && "Tudo pronto!"}
          </CardTitle>
          <CardDescription>
            {current.id === "profile" && "Confirme seu nome e telefone para que sua equipe te identifique."}
            {current.id === "company" && "Identifique sua organização para personalizar a plataforma."}
            {current.id === "notifications" && "Receba alertas no Slack quando metas mudarem de status. Opcional."}
            {current.id === "meta" && "Crie a primeira meta da sua operação. Você pode pular e criar depois."}
            {current.id === "done" && "Sua plataforma está configurada. Bom trabalho!"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {current.id === "profile" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo *</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={30} />
              </div>
            </>
          )}

          {current.id === "company" && (
            <div className="space-y-2">
              <Label htmlFor="company">Nome da empresa *</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
            </div>
          )}

          {current.id === "notifications" && (
            <div className="space-y-2">
              <Label htmlFor="slack">Webhook do Slack</Label>
              <Input
                id="slack"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
              />
              <p className="text-xs text-muted-foreground">
                Cole um Incoming Webhook do Slack. Deixe em branco para pular — você pode configurar depois em Integrações.
              </p>
            </div>
          )}

          {current.id === "meta" && (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="cursor-pointer">Criar a primeira meta agora</Label>
                  <p className="text-xs text-muted-foreground">Desative para pular esta etapa.</p>
                </div>
                <Switch checked={criarMeta} onCheckedChange={setCriarMeta} />
              </div>

              {criarMeta && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-nome">Nome da meta *</Label>
                    <Input id="meta-nome" value={metaNome} onChange={(e) => setMetaNome(e.target.value)} placeholder="Ex: Receita MRR Maio" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Área *</Label>
                      <Select value={metaArea} onValueChange={setMetaArea}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AREAS.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Periodicidade *</Label>
                      <Select value={metaPeriod} onValueChange={setMetaPeriod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PERIODICIDADES.map((p) => (<SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="meta-valor">Valor alvo *</Label>
                      <Input id="meta-valor" inputMode="decimal" value={metaValor} onChange={(e) => setMetaValor(e.target.value)} placeholder="120000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="meta-unidade">Unidade *</Label>
                      <Input id="meta-unidade" value={metaUnidade} onChange={(e) => setMetaUnidade(e.target.value)} placeholder="R$" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="meta-inicio">Início *</Label>
                      <Input id="meta-inicio" type="date" value={metaInicio} onChange={(e) => setMetaInicio(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="meta-fim">Fim *</Label>
                      <Input id="meta-fim" type="date" value={metaFim} onChange={(e) => setMetaFim(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">Meta inversa (menor é melhor)</Label>
                      <p className="text-xs text-muted-foreground">Para churn, custos, tempo de resposta etc.</p>
                    </div>
                    <Switch checked={metaInverse} onCheckedChange={setMetaInverse} />
                  </div>
                </div>
              )}
            </>
          )}

          {isDone && (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <div className="h-14 w-14 rounded-full bg-[var(--color-blue-soft)] flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" style={{ color: "var(--color-blue)" }} />
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                Você pode revisar tudo a qualquer momento em{" "}
                <strong>Configurações</strong>. Para refazer este assistente, vá em
                <strong> Configurações → Onboarding</strong>.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div className="flex gap-2">
            {!isDone && (
              <Button variant="ghost" onClick={handleSkip} disabled={saving}>
                Pular onboarding
              </Button>
            )}
            {stepIdx > 0 && !isDone && (
              <Button variant="outline" onClick={goBack} disabled={saving}>
                Voltar
              </Button>
            )}
          </div>
          {isDone ? (
            <Button onClick={handleFinish} style={{ backgroundColor: "var(--color-blue)", color: "white" }} className="hover:opacity-90">
              Ir para o dashboard
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={saving} style={{ backgroundColor: "var(--color-blue)", color: "white" }} className="hover:opacity-90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {stepIdx === STEPS.length - 2 ? "Finalizar" : "Continuar"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
