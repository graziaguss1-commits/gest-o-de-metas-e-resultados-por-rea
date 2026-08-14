-- Metas privadas, responsáveis múltiplos e crédito de execução por pessoa.
-- Regra central: nem mesmo um administrador lê uma meta da qual não participa.

UPDATE public.project_config
SET value = 'true', updated_at = now()
WHERE key = 'require_account_approval';

CREATE TABLE IF NOT EXISTS public.meta_responsaveis (
  meta_id uuid NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adicionado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meta_id, user_id)
);

CREATE INDEX IF NOT EXISTS meta_responsaveis_user_idx
  ON public.meta_responsaveis (user_id, meta_id);

-- Preserva o responsável das metas antigas. Quando não havia responsável,
-- a meta passa a pertencer a quem a criou.
INSERT INTO public.meta_responsaveis (meta_id, user_id, adicionado_por)
SELECT m.id, COALESCE(m.responsavel_id, m.criado_por), m.criado_por
FROM public.metas m
WHERE COALESCE(m.responsavel_id, m.criado_por) IS NOT NULL
ON CONFLICT (meta_id, user_id) DO NOTHING;

-- Se ações antigas já tinham outro responsável, ele também passa a participar
-- daquela meta para que nada desapareça após a ativação da privacidade.
INSERT INTO public.meta_responsaveis (meta_id, user_id, adicionado_por)
SELECT DISTINCT p.meta_id, t.responsavel_id, p.criado_por
FROM public.plano_tarefas t
JOIN public.planos_acao p ON p.id = t.plano_id
WHERE p.meta_id IS NOT NULL
  AND t.responsavel_id IS NOT NULL
ON CONFLICT (meta_id, user_id) DO NOTHING;

-- Ações antigas sem responsável recebem o responsável principal da meta.
-- Em planos sem meta, recebem quem criou o plano.
UPDATE public.plano_tarefas t
SET responsavel_id = COALESCE(m.responsavel_id, p.criado_por)
FROM public.planos_acao p
LEFT JOIN public.metas m ON m.id = p.meta_id
WHERE t.plano_id = p.id
  AND t.responsavel_id IS NULL;

CREATE OR REPLACE FUNCTION public.is_meta_responsavel(
  p_meta_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.meta_responsaveis mr
    WHERE mr.meta_id = p_meta_id
      AND mr.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_meta(p_meta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_member()
    AND public.is_meta_responsavel(p_meta_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_access_plan(p_plano_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_member() AND EXISTS (
    SELECT 1
    FROM public.planos_acao p
    WHERE p.id = p_plano_id
      AND (
        (p.meta_id IS NOT NULL AND public.is_meta_responsavel(p.meta_id, auth.uid()))
        OR (p.meta_id IS NULL AND p.criado_por = auth.uid())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_task(p_tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_member() AND EXISTS (
    SELECT 1
    FROM public.plano_tarefas t
    WHERE t.id = p_tarefa_id
      AND public.can_access_plan(t.plano_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_task_responsavel(p_tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_member() AND EXISTS (
    SELECT 1
    FROM public.plano_tarefas t
    WHERE t.id = p_tarefa_id
      AND public.can_access_plan(t.plano_id)
      AND (t.responsavel_id = auth.uid() OR t.responsavel_id IS NULL)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_meta_responsavel(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_meta(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_plan(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_task_responsavel(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_meta_responsavel(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_meta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_responsavel(uuid) TO authenticated;

-- Diretório seguro: expõe apenas os dados necessários para selecionar responsáveis.
CREATE OR REPLACE FUNCTION public.get_team_directory()
RETURNS TABLE (id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE public.is_active_member()
    AND p.is_active = true
    AND p.is_approved = true
  ORDER BY p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_directory() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_team_directory() TO authenticated;

-- Criação atômica: permite criar uma meta apenas para outra pessoa sem
-- conceder acesso permanente a quem realizou o cadastro.
CREATE OR REPLACE FUNCTION public.criar_meta_com_responsaveis(
  p_meta jsonb,
  p_responsaveis uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_responsaveis uuid[];
  v_responsavel_principal uuid;
  v_validos integer;
BEGIN
  IF NOT public.is_active_member() THEN
    RAISE EXCEPTION 'Usuário sem acesso ativo.';
  END IF;

  SELECT array_agg(user_id ORDER BY first_ord)
  INTO v_responsaveis
  FROM (
    SELECT u.user_id, min(u.ord) AS first_ord
    FROM unnest(COALESCE(p_responsaveis, ARRAY[]::uuid[]))
      WITH ORDINALITY AS u(user_id, ord)
    WHERE u.user_id IS NOT NULL
    GROUP BY u.user_id
  ) normalizados;

  IF COALESCE(cardinality(v_responsaveis), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um responsável.';
  END IF;

  SELECT count(*)
  INTO v_validos
  FROM public.profiles p
  WHERE p.id = ANY(v_responsaveis)
    AND p.is_active = true
    AND p.is_approved = true;

  IF v_validos <> cardinality(v_responsaveis) THEN
    RAISE EXCEPTION 'Há um responsável inválido ou inativo.';
  END IF;

  v_responsavel_principal := v_responsaveis[1];

  INSERT INTO public.metas (
    id, nome, descricao, area, responsavel_id, valor_alvo, valor_atual,
    unidade, periodicidade, data_inicio, data_fim, status, is_inverse,
    is_demo, criado_por, metric_type, funil_ativo
  ) VALUES (
    v_id,
    btrim(p_meta->>'nome'),
    NULLIF(btrim(COALESCE(p_meta->>'descricao', '')), ''),
    p_meta->>'area',
    v_responsavel_principal,
    (p_meta->>'valor_alvo')::numeric,
    COALESCE((p_meta->>'valor_atual')::numeric, 0),
    p_meta->>'unidade',
    p_meta->>'periodicidade',
    (p_meta->>'data_inicio')::date,
    (p_meta->>'data_fim')::date,
    COALESCE(NULLIF(p_meta->>'status', ''), 'verde'),
    COALESCE((p_meta->>'is_inverse')::boolean, false),
    COALESCE((p_meta->>'is_demo')::boolean, false),
    auth.uid(),
    COALESCE(NULLIF(p_meta->>'metric_type', ''), 'quantidade'),
    COALESCE((p_meta->>'funil_ativo')::boolean, false)
  );

  INSERT INTO public.meta_responsaveis (meta_id, user_id, adicionado_por)
  SELECT v_id, user_id, auth.uid()
  FROM unnest(v_responsaveis) AS user_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_meta_com_responsaveis(
  p_meta_id uuid,
  p_patch jsonb,
  p_responsaveis uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsaveis uuid[];
  v_validos integer;
  v_acoes_fora integer;
BEGIN
  IF NOT public.can_access_meta(p_meta_id) THEN
    RAISE EXCEPTION 'Você não tem acesso a esta meta.';
  END IF;

  SELECT array_agg(user_id ORDER BY first_ord)
  INTO v_responsaveis
  FROM (
    SELECT u.user_id, min(u.ord) AS first_ord
    FROM unnest(COALESCE(p_responsaveis, ARRAY[]::uuid[]))
      WITH ORDINALITY AS u(user_id, ord)
    WHERE u.user_id IS NOT NULL
    GROUP BY u.user_id
  ) normalizados;

  IF COALESCE(cardinality(v_responsaveis), 0) = 0 THEN
    RAISE EXCEPTION 'A meta precisa ter ao menos um responsável.';
  END IF;

  SELECT count(*)
  INTO v_validos
  FROM public.profiles p
  WHERE p.id = ANY(v_responsaveis)
    AND p.is_active = true
    AND p.is_approved = true;

  IF v_validos <> cardinality(v_responsaveis) THEN
    RAISE EXCEPTION 'Há um responsável inválido ou inativo.';
  END IF;

  SELECT count(*)
  INTO v_acoes_fora
  FROM public.plano_tarefas t
  JOIN public.planos_acao p ON p.id = t.plano_id
  WHERE p.meta_id = p_meta_id
    AND t.responsavel_id IS NOT NULL
    AND NOT (t.responsavel_id = ANY(v_responsaveis));

  IF v_acoes_fora > 0 THEN
    RAISE EXCEPTION
      'Reatribua as ações desta pessoa antes de removê-la dos responsáveis da meta.';
  END IF;

  -- Inclui os novos participantes antes de trocar o responsável principal.
  INSERT INTO public.meta_responsaveis (meta_id, user_id, adicionado_por)
  SELECT p_meta_id, user_id, auth.uid()
  FROM unnest(v_responsaveis) AS user_id
  ON CONFLICT (meta_id, user_id) DO NOTHING;

  UPDATE public.metas
  SET
    nome = COALESCE(NULLIF(btrim(p_patch->>'nome'), ''), nome),
    descricao = CASE
      WHEN p_patch ? 'descricao'
        THEN NULLIF(btrim(COALESCE(p_patch->>'descricao', '')), '')
      ELSE descricao
    END,
    area = COALESCE(NULLIF(p_patch->>'area', ''), area),
    responsavel_id = v_responsaveis[1],
    valor_alvo = COALESCE((p_patch->>'valor_alvo')::numeric, valor_alvo),
    unidade = COALESCE(NULLIF(p_patch->>'unidade', ''), unidade),
    periodicidade = COALESCE(NULLIF(p_patch->>'periodicidade', ''), periodicidade),
    data_inicio = COALESCE((p_patch->>'data_inicio')::date, data_inicio),
    data_fim = COALESCE((p_patch->>'data_fim')::date, data_fim),
    is_inverse = CASE
      WHEN p_patch ? 'is_inverse' THEN (p_patch->>'is_inverse')::boolean
      ELSE is_inverse
    END,
    metric_type = COALESCE(NULLIF(p_patch->>'metric_type', ''), metric_type),
    funil_ativo = CASE
      WHEN p_patch ? 'funil_ativo' THEN (p_patch->>'funil_ativo')::boolean
      ELSE funil_ativo
    END
  WHERE id = p_meta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta não encontrada.';
  END IF;

  DELETE FROM public.meta_responsaveis
  WHERE meta_id = p_meta_id
    AND NOT (user_id = ANY(v_responsaveis));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_meta_com_responsaveis(jsonb, uuid[]) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_meta_com_responsaveis(uuid, jsonb, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_meta_com_responsaveis(jsonb, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_meta_com_responsaveis(uuid, jsonb, uuid[]) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.meta_responsaveis FROM authenticated, anon;
GRANT SELECT ON public.meta_responsaveis TO authenticated;
GRANT ALL ON public.meta_responsaveis TO service_role;
ALTER TABLE public.meta_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responsaveis read membership" ON public.meta_responsaveis;
CREATE POLICY "responsaveis read membership"
  ON public.meta_responsaveis FOR SELECT TO authenticated
  USING (public.can_access_meta(meta_id));

-- ---------------------------------------------------------------------------
-- Metas e todos os dados derivados: somente participantes da própria meta.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "members read metas" ON public.metas;
DROP POLICY IF EXISTS "members insert metas" ON public.metas;
DROP POLICY IF EXISTS "members update metas" ON public.metas;
DROP POLICY IF EXISTS "admins delete metas" ON public.metas;
CREATE POLICY "responsaveis read metas" ON public.metas
  FOR SELECT TO authenticated USING (public.can_access_meta(id));
REVOKE INSERT ON public.metas FROM authenticated, anon;
CREATE POLICY "responsaveis update metas" ON public.metas
  FOR UPDATE TO authenticated
  USING (public.can_access_meta(id))
  WITH CHECK (public.can_access_meta(id));
CREATE POLICY "responsaveis delete metas" ON public.metas
  FOR DELETE TO authenticated USING (public.can_access_meta(id));


CREATE OR REPLACE FUNCTION public.tg_validar_responsavel_principal_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.responsavel_id IS NOT NULL
    AND auth.role() <> 'service_role'
    AND NOT public.is_meta_responsavel(NEW.id, NEW.responsavel_id)
  THEN
    RAISE EXCEPTION 'O responsável principal precisa participar da meta.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_responsavel_principal_meta ON public.metas;
CREATE TRIGGER validar_responsavel_principal_meta
  BEFORE UPDATE OF responsavel_id ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.tg_validar_responsavel_principal_meta();

DROP POLICY IF EXISTS "members read lancamentos" ON public.meta_lancamentos;
DROP POLICY IF EXISTS "members insert lancamentos" ON public.meta_lancamentos;
DROP POLICY IF EXISTS "admins delete lancamentos" ON public.meta_lancamentos;
CREATE POLICY "responsaveis read lancamentos" ON public.meta_lancamentos
  FOR SELECT TO authenticated USING (public.can_access_meta(meta_id));
CREATE POLICY "responsaveis insert lancamentos" ON public.meta_lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_meta(meta_id) AND lancado_por = auth.uid());
CREATE POLICY "authors delete lancamentos" ON public.meta_lancamentos
  FOR DELETE TO authenticated
  USING (public.can_access_meta(meta_id) AND lancado_por = auth.uid());

DROP POLICY IF EXISTS "members read comentarios" ON public.meta_comentarios;
DROP POLICY IF EXISTS "members insert comentarios" ON public.meta_comentarios;
DROP POLICY IF EXISTS "admins delete comentarios" ON public.meta_comentarios;
CREATE POLICY "responsaveis read comentarios" ON public.meta_comentarios
  FOR SELECT TO authenticated USING (public.can_access_meta(meta_id));
CREATE POLICY "responsaveis insert comentarios" ON public.meta_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_meta(meta_id) AND autor_id = auth.uid());
CREATE POLICY "authors delete comentarios" ON public.meta_comentarios
  FOR DELETE TO authenticated
  USING (public.can_access_meta(meta_id) AND autor_id = auth.uid());

DROP POLICY IF EXISTS "members read funil" ON public.meta_funil_etapas;
DROP POLICY IF EXISTS "members write funil" ON public.meta_funil_etapas;
CREATE POLICY "responsaveis read funil" ON public.meta_funil_etapas
  FOR SELECT TO authenticated USING (public.can_access_meta(meta_id));
CREATE POLICY "responsaveis write funil" ON public.meta_funil_etapas
  FOR ALL TO authenticated
  USING (public.can_access_meta(meta_id))
  WITH CHECK (public.can_access_meta(meta_id));

-- ---------------------------------------------------------------------------
-- Planos e ações: compartilhados somente entre os responsáveis da meta.
-- Planos sem meta continuam privados para quem os criou.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "members read planos" ON public.planos_acao;
DROP POLICY IF EXISTS "members write planos" ON public.planos_acao;
CREATE POLICY "participants read planos" ON public.planos_acao
  FOR SELECT TO authenticated USING (public.can_access_plan(id));
CREATE POLICY "participants insert planos" ON public.planos_acao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_member()
    AND criado_por = auth.uid()
    AND (meta_id IS NULL OR public.can_access_meta(meta_id))
  );
CREATE POLICY "participants update planos" ON public.planos_acao
  FOR UPDATE TO authenticated
  USING (public.can_access_plan(id))
  WITH CHECK (
    public.is_active_member()
    AND (meta_id IS NULL OR public.can_access_meta(meta_id))
  );
CREATE POLICY "participants delete planos" ON public.planos_acao
  FOR DELETE TO authenticated USING (public.can_access_plan(id));

DROP POLICY IF EXISTS "members read tarefas" ON public.plano_tarefas;
DROP POLICY IF EXISTS "members write tarefas" ON public.plano_tarefas;
CREATE POLICY "participants read tarefas" ON public.plano_tarefas
  FOR SELECT TO authenticated USING (public.can_access_plan(plano_id));
CREATE POLICY "participants insert tarefas" ON public.plano_tarefas
  FOR INSERT TO authenticated WITH CHECK (public.can_access_plan(plano_id));
CREATE POLICY "responsible updates tarefas" ON public.plano_tarefas
  FOR UPDATE TO authenticated
  USING (
    public.can_access_plan(plano_id)
    AND (responsavel_id = auth.uid() OR responsavel_id IS NULL)
  )
  WITH CHECK (public.can_access_plan(plano_id));
CREATE POLICY "participants delete tarefas" ON public.plano_tarefas
  FOR DELETE TO authenticated USING (public.can_access_plan(plano_id));

CREATE OR REPLACE FUNCTION public.tg_validar_responsavel_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta_id uuid;
  v_criado_por uuid;
BEGIN
  SELECT p.meta_id, p.criado_por
  INTO v_meta_id, v_criado_por
  FROM public.planos_acao p
  WHERE p.id = NEW.plano_id;

  IF NEW.responsavel_id IS NULL THEN
    NEW.responsavel_id := COALESCE(auth.uid(), v_criado_por);
  END IF;

  IF v_meta_id IS NULL THEN
    IF NEW.responsavel_id IS DISTINCT FROM v_criado_por THEN
      RAISE EXCEPTION 'Em um plano pessoal, o responsável deve ser quem criou o plano.';
    END IF;
  ELSIF NOT public.is_meta_responsavel(v_meta_id, NEW.responsavel_id) THEN
    RAISE EXCEPTION 'O responsável da ação precisa participar da meta.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_responsavel_tarefa ON public.plano_tarefas;
CREATE TRIGGER validar_responsavel_tarefa
  BEFORE INSERT OR UPDATE OF plano_id, responsavel_id
  ON public.plano_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_validar_responsavel_tarefa();

CREATE OR REPLACE FUNCTION public.tg_proteger_conclusao_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.concluida IS DISTINCT FROM OLD.concluida
    AND auth.role() <> 'service_role'
    AND (
      OLD.responsavel_id IS DISTINCT FROM auth.uid()
      OR NEW.responsavel_id IS DISTINCT FROM auth.uid()
    )
  THEN
    RAISE EXCEPTION 'Somente o responsável pode concluir ou reabrir esta ação.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_conclusao_tarefa ON public.plano_tarefas;
CREATE TRIGGER proteger_conclusao_tarefa
  BEFORE UPDATE OF concluida ON public.plano_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_proteger_conclusao_tarefa();

DROP POLICY IF EXISTS "members read execucoes" ON public.tarefa_execucoes;
DROP POLICY IF EXISTS "members insert execucoes" ON public.tarefa_execucoes;
DROP POLICY IF EXISTS "owners update execucoes" ON public.tarefa_execucoes;
DROP POLICY IF EXISTS "owners delete execucoes" ON public.tarefa_execucoes;
CREATE POLICY "participants read execucoes" ON public.tarefa_execucoes
  FOR SELECT TO authenticated USING (public.can_access_task(tarefa_id));
CREATE POLICY "responsible inserts execucoes" ON public.tarefa_execucoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_task_responsavel(tarefa_id) AND registrado_por = auth.uid());
CREATE POLICY "responsible updates execucoes" ON public.tarefa_execucoes
  FOR UPDATE TO authenticated
  USING (public.is_task_responsavel(tarefa_id) AND registrado_por = auth.uid())
  WITH CHECK (public.is_task_responsavel(tarefa_id) AND registrado_por = auth.uid());
CREATE POLICY "responsible deletes execucoes" ON public.tarefa_execucoes
  FOR DELETE TO authenticated
  USING (public.is_task_responsavel(tarefa_id) AND registrado_por = auth.uid());

DROP POLICY IF EXISTS "members read agendamentos" ON public.tarefa_agendamentos;
DROP POLICY IF EXISTS "members insert agendamentos" ON public.tarefa_agendamentos;
DROP POLICY IF EXISTS "members update agendamentos" ON public.tarefa_agendamentos;
DROP POLICY IF EXISTS "owners delete agendamentos" ON public.tarefa_agendamentos;
CREATE POLICY "responsible reads agendamentos" ON public.tarefa_agendamentos
  FOR SELECT TO authenticated USING (public.is_task_responsavel(tarefa_id));
CREATE POLICY "responsible inserts agendamentos" ON public.tarefa_agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_task_responsavel(tarefa_id) AND criado_por = auth.uid());
CREATE POLICY "responsible updates agendamentos" ON public.tarefa_agendamentos
  FOR UPDATE TO authenticated
  USING (public.is_task_responsavel(tarefa_id))
  WITH CHECK (public.is_task_responsavel(tarefa_id));
CREATE POLICY "responsible deletes agendamentos" ON public.tarefa_agendamentos
  FOR DELETE TO authenticated USING (public.is_task_responsavel(tarefa_id));

-- Compromissos e prioridades avulsas são sempre pessoais.
DROP POLICY IF EXISTS "members read commitments" ON public.compromissos;
DROP POLICY IF EXISTS "members create commitments" ON public.compromissos;
DROP POLICY IF EXISTS "members update commitments" ON public.compromissos;
DROP POLICY IF EXISTS "members delete commitments" ON public.compromissos;
CREATE POLICY "owners read commitments" ON public.compromissos
  FOR SELECT TO authenticated USING (public.is_active_member() AND criado_por = auth.uid());
CREATE POLICY "owners create commitments" ON public.compromissos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member() AND criado_por = auth.uid());
CREATE POLICY "owners update commitments" ON public.compromissos
  FOR UPDATE TO authenticated
  USING (public.is_active_member() AND criado_por = auth.uid())
  WITH CHECK (public.is_active_member() AND criado_por = auth.uid());
CREATE POLICY "owners delete commitments" ON public.compromissos
  FOR DELETE TO authenticated USING (public.is_active_member() AND criado_por = auth.uid());

DROP POLICY IF EXISTS "members manage standalone actions" ON public.acoes_avulsas;
CREATE POLICY "owners manage standalone actions" ON public.acoes_avulsas
  FOR ALL TO authenticated
  USING (public.is_active_member() AND criado_por = auth.uid())
  WITH CHECK (public.is_active_member() AND criado_por = auth.uid());

-- A view também precisa respeitar as políticas da tabela metas.
CREATE OR REPLACE VIEW public.metas_with_responsavel
WITH (security_invoker = true)
AS
SELECT
  m.id, m.nome, m.descricao, m.area, m.responsavel_id,
  m.valor_alvo, m.valor_atual, m.unidade, m.periodicidade,
  m.data_inicio, m.data_fim, m.status, m.is_inverse, m.is_demo,
  m.criado_por, m.created_at, m.updated_at, m.metric_type,
  p.full_name AS responsavel_nome,
  p.avatar_url AS responsavel_avatar,
  p.email AS responsavel_email,
  m.funil_ativo
FROM public.metas m
LEFT JOIN public.profiles p ON p.id = m.responsavel_id;

GRANT SELECT ON public.metas_with_responsavel TO authenticated;

COMMENT ON TABLE public.meta_responsaveis IS
  'Participantes que podem ver a meta. Administradores não recebem acesso implícito.';
COMMENT ON COLUMN public.plano_tarefas.responsavel_id IS
  'Pessoa creditada pela execução da ação e autorizada a registrar o realizado.';
