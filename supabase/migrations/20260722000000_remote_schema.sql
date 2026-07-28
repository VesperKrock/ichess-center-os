-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM service_role;

CREATE FUNCTION public.can_write_center (
  requested_center_id text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.center_members
    where center_id = requested_center_id
      and user_id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and lower(role) in ('owner', 'qtv', 'center_admin', 'admin')
  );
$function$;

GRANT ALL ON FUNCTION public.can_write_center(text) TO authenticated;

CREATE FUNCTION public.ichess_slugify_center_name_compact (
  input text
)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public', 'extensions'
  AS $function$
declare
  normalized text;
begin
  normalized := lower(trim(coalesce(input, '')));
  normalized := replace(normalized, 'đ', 'd');
  normalized := replace(normalized, 'Đ', 'd');
  normalized := translate(
    normalized,
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyy'
  );
  normalized := regexp_replace(normalized, '[^a-z0-9]+', '', 'g');
  return normalized;
end;
$function$;

COMMENT ON FUNCTION public.ichess_slugify_center_name_compact(text) IS 'C6.6 helper: compact Vietnamese center slug, no accents, no hyphen.';

CREATE FUNCTION public.is_center_member (
  requested_center_id text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.center_members
    where center_id = requested_center_id
      and user_id = auth.uid()
      and coalesce(status, 'active') = 'active'
  );
$function$;

GRANT ALL ON FUNCTION public.is_center_member(text) TO authenticated;

CREATE FUNCTION public.provision_center_for_owner (
  p_center_name text
)
  RETURNS TABLE (
    id          text,
    name        text,
    slug        text,
    environment text,
    status      text,
    created_at  timestamp with time zone,
    updated_at  timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth', 'extensions'
  AS $function$
declare
  current_user_id uuid;
  normalized_name text;
  generated_slug text;
  generated_center_id text;
  created_center public.centers%rowtype;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.center_members cm
    where cm.user_id = current_user_id
      and cm.role = 'owner'
      and cm.status = 'active'
  ) then
    raise exception 'owner_membership_required';
  end if;

  normalized_name := trim(coalesce(p_center_name, ''));

  if length(normalized_name) < 2 then
    raise exception 'center_name_too_short';
  end if;

  generated_slug := public.ichess_slugify_center_name_compact(normalized_name);

  if generated_slug = '' then
    raise exception 'center_slug_empty';
  end if;

  generated_center_id := generated_slug || '_prod';

  if exists (
    select 1
    from public.centers c
    where c.id = generated_center_id
  ) then
    raise exception 'center_id_already_exists';
  end if;

  if exists (
    select 1
    from public.centers c
    where c.slug = generated_slug
      and c.environment = 'production'
  ) then
    raise exception 'center_slug_environment_already_exists';
  end if;

  insert into public.centers (
    id,
    name,
    slug,
    environment,
    status
  )
  values (
    generated_center_id,
    normalized_name,
    generated_slug,
    'production',
    'active'
  )
  returning * into created_center;

  insert into public.center_members (
    user_id,
    center_id,
    role,
    status
  )
  select
    current_user_id,
    generated_center_id,
    'owner',
    'active'
  where not exists (
    select 1
    from public.center_members cm
    where cm.user_id = current_user_id
      and cm.center_id = generated_center_id
  );

  return query
  select
    created_center.id,
    created_center.name,
    created_center.slug,
    created_center.environment,
    created_center.status,
    created_center.created_at,
    created_center.updated_at;
end;
$function$;

COMMENT ON FUNCTION public.provision_center_for_owner(text) IS 'C6.6 guarded RPC: one visible input p_center_name, provisions empty production center metadata and owner membership when explicitly called after apply.';

GRANT ALL ON FUNCTION public.provision_center_for_owner(text) TO authenticated;

CREATE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE FUNCTION public.set_center_cloud_entities_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE TABLE public.account_audit_logs (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  actor_user_id  uuid,
  actor_email    text,
  action         text                     NOT NULL,
  target_type    text                     NOT NULL,
  target_user_id uuid,
  target_email   text,
  center_id      text,
  before_state   jsonb,
  after_state    jsonb,
  reason         text,
  request_id     text,
  metadata       jsonb                    DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE public.account_audit_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_action_not_empty CHECK (length(TRIM(BOTH FROM action)) > 0) NOT VALID;

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_actor_email_sane CHECK (actor_email IS NULL OR length(actor_email) >= 3 AND length(actor_email) <= 320) NOT VALID;

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_after_state_no_plaintext_password_keys CHECK (after_state IS NULL OR NOT after_state ? 'temporary_password'::text AND
    NOT after_state ? 'password'::text AND NOT after_state ? 'plaintext_password'::text) NOT VALID;

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_before_state_no_plaintext_password_keys CHECK (before_state IS NULL OR NOT before_state ? 'temporary_password'::text AND
    NOT before_state ? 'password'::text AND NOT before_state ? 'plaintext_password'::text) NOT VALID;

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_metadata_no_plaintext_password_keys CHECK (NOT metadata ? 'temporary_password'::text AND NOT metadata ? 'password'::text AND
    NOT metadata ? 'plaintext_password'::text) NOT VALID;

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_target_email_sane CHECK (target_email IS NULL OR length(target_email) >= 3 AND length(target_email) <= 320) NOT VALID;

ALTER TABLE public.account_audit_logs
  ADD CONSTRAINT account_audit_logs_target_type_not_empty CHECK (length(TRIM(BOTH FROM target_type)) > 0) NOT VALID;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.account_audit_logs TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.account_audit_logs TO authenticated;

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.account_audit_logs TO service_role;

CREATE INDEX account_audit_logs_target_user_id_idx ON public.account_audit_logs (target_user_id);

CREATE INDEX account_audit_logs_created_at_desc_idx ON public.account_audit_logs (created_at DESC);

CREATE INDEX account_audit_logs_request_id_idx ON public.account_audit_logs (request_id);

CREATE INDEX account_audit_logs_action_idx ON public.account_audit_logs (action);

CREATE INDEX account_audit_logs_center_id_idx ON public.account_audit_logs (center_id);

CREATE INDEX account_audit_logs_target_email_idx ON public.account_audit_logs (target_email);

CREATE INDEX account_audit_logs_actor_user_id_idx ON public.account_audit_logs (actor_user_id);

CREATE TABLE public.center_cloud_entities (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  center_id      text                     NOT NULL,
  entity_type    text                     NOT NULL,
  local_id       text                     NOT NULL,
  payload        jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  source_module  text,
  source_version text,
  deleted_at     timestamp with time zone,
  created_by     uuid,
  updated_by     uuid,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone DEFAULT now() NOT NULL
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.center_cloud_entities;

ALTER TABLE public.center_cloud_entities
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.center_cloud_entities
  REPLICA IDENTITY FULL;

ALTER TABLE public.center_cloud_entities
  ADD CONSTRAINT center_cloud_entities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.center_cloud_entities
  ADD CONSTRAINT center_cloud_entities_entity_type_check
    CHECK
    (entity_type = ANY (ARRAY['student'::text, 'teacher'::text, 'class_session'::text, 'schedule_session'::text, 'attendance_record'::text, 'attendance_baseline_state'::text,
    'session_report'::text, 'tuition_record_package'::text, 'audit_log_entry'::text]));

ALTER TABLE public.center_cloud_entities
  ADD CONSTRAINT center_cloud_entities_pkey PRIMARY KEY (id);

ALTER TABLE public.center_cloud_entities
  ADD CONSTRAINT center_cloud_entities_unique_entity UNIQUE (center_id, entity_type, local_id);

ALTER TABLE public.center_cloud_entities
  ADD CONSTRAINT center_cloud_entities_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.center_cloud_entities TO anon;

GRANT ALL ON public.center_cloud_entities TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.center_cloud_entities TO service_role;

CREATE INDEX center_cloud_entities_center_type_idx ON public.center_cloud_entities (center_id, entity_type);

CREATE INDEX center_cloud_entities_updated_at_idx ON public.center_cloud_entities (updated_at DESC);

CREATE TRIGGER set_center_cloud_entities_updated_at
  BEFORE UPDATE ON public.center_cloud_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_center_cloud_entities_updated_at();

CREATE POLICY "c4_6b center members read cloud entities" ON public.center_cloud_entities
  FOR SELECT
  TO authenticated
  USING (public.is_center_member(center_id));

CREATE POLICY "c4_6b center writers insert cloud entities" ON public.center_cloud_entities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_center(center_id));

CREATE POLICY "c4_6b center writers update cloud entities" ON public.center_cloud_entities
  FOR UPDATE
  TO authenticated
  USING (public.can_write_center(center_id))
  WITH CHECK (public.can_write_center(center_id));

CREATE POLICY "center members can delete cloud entities" ON public.center_cloud_entities
  FOR DELETE
  TO authenticated
  USING (public.is_center_member(center_id));

CREATE POLICY "center members can insert cloud entities" ON public.center_cloud_entities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_center_member(center_id));

CREATE POLICY "center members can select cloud entities" ON public.center_cloud_entities
  FOR SELECT
  TO authenticated
  USING (public.is_center_member(center_id));

CREATE POLICY "center members can update cloud entities" ON public.center_cloud_entities
  FOR UPDATE
  TO authenticated
  USING (public.is_center_member(center_id))
  WITH CHECK (public.is_center_member(center_id));

CREATE TABLE public.center_members (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  center_id  text                     NOT NULL,
  user_id    uuid                     NOT NULL,
  role       text                     DEFAULT 'admin'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  status     text                     DEFAULT 'active'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.center_members
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.center_members
  ADD CONSTRAINT center_members_center_id_user_id_key UNIQUE (center_id, user_id);

ALTER TABLE public.center_members
  ADD CONSTRAINT center_members_pkey PRIMARY KEY (id);

ALTER TABLE public.center_members
  ADD CONSTRAINT center_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.center_members TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.center_members TO authenticated;

GRANT ALL ON public.center_members TO service_role;

CREATE INDEX center_members_user_idx ON public.center_members (user_id);

CREATE INDEX center_members_center_user_idx ON public.center_members (center_id, user_id);

CREATE INDEX center_members_center_user_status_idx ON public.center_members (center_id, user_id, status);

CREATE POLICY "c4_6b members read own membership" ON public.center_members
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "members can view own memberships" ON public.center_members
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()));

CREATE TABLE public.centers (
  id          text                     NOT NULL,
  name        text                     NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  slug        text,
  environment text                     DEFAULT 'production'::text,
  status      text                     DEFAULT 'active'::text,
  updated_at  timestamp with time zone DEFAULT now()
);

ALTER TABLE public.centers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.centers
  ADD CONSTRAINT centers_environment_check CHECK (environment = ANY (ARRAY['production'::text, 'staging'::text, 'test'::text, 'development'::text]));

ALTER TABLE public.centers
  ADD CONSTRAINT centers_pkey PRIMARY KEY (id);

ALTER TABLE public.center_members
  ADD CONSTRAINT center_members_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE CASCADE;

ALTER TABLE public.centers
  ADD CONSTRAINT centers_status_check CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'archived'::text]));

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.centers TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.centers TO authenticated;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.centers TO service_role;

CREATE INDEX centers_environment_idx ON public.centers (environment);

CREATE INDEX centers_status_idx ON public.centers (status);

CREATE UNIQUE INDEX centers_slug_environment_unique_idx ON public.centers (slug, environment)
  WHERE slug IS NOT NULL AND environment IS NOT NULL;

CREATE POLICY "members can view centers" ON public.centers
  FOR SELECT
  TO authenticated
  USING ((id IN ( SELECT center_members.center_id
   FROM public.center_members
  WHERE (center_members.user_id = auth.uid()))));

CREATE TABLE public.transaction_attachments (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  center_id        text                     NOT NULL,
  transaction_code text                     NOT NULL,
  transaction_date date,
  month_key        text                     NOT NULL,
  amount           numeric,
  cashflow_type    text,
  note             text,
  original_name    text                     NOT NULL,
  file_name        text                     NOT NULL,
  mime_type        text                     NOT NULL,
  size_bytes       bigint                   DEFAULT 0 NOT NULL,
  storage_bucket   text                     DEFAULT 'transaction-images'::text NOT NULL,
  storage_path     text                     NOT NULL,
  uploaded_by      uuid,
  created_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.transaction_attachments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transaction_attachments
  ADD CONSTRAINT transaction_attachments_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE CASCADE;

ALTER TABLE public.transaction_attachments
  ADD CONSTRAINT transaction_attachments_pkey PRIMARY KEY (id);

ALTER TABLE public.transaction_attachments
  ADD CONSTRAINT transaction_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.transaction_attachments TO anon;

GRANT ALL ON public.transaction_attachments TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.transaction_attachments TO service_role;

CREATE POLICY "members can delete transaction attachments" ON public.transaction_attachments
  FOR DELETE
  TO authenticated
  USING ((center_id IN ( SELECT center_members.center_id
   FROM public.center_members
  WHERE (center_members.user_id = auth.uid()))));

CREATE POLICY "members can insert transaction attachments" ON public.transaction_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (((center_id IN ( SELECT center_members.center_id
   FROM public.center_members
  WHERE (center_members.user_id = auth.uid()))) AND (uploaded_by = auth.uid())));

CREATE POLICY "members can update transaction attachments" ON public.transaction_attachments
  FOR UPDATE
  TO authenticated
  USING ((center_id IN ( SELECT center_members.center_id
   FROM public.center_members
  WHERE (center_members.user_id = auth.uid()))))
  WITH CHECK ((center_id IN ( SELECT center_members.center_id
   FROM public.center_members
  WHERE (center_members.user_id = auth.uid()))));

CREATE POLICY "members can view transaction attachments" ON public.transaction_attachments
  FOR SELECT
  TO authenticated
  USING ((center_id IN ( SELECT center_members.center_id
   FROM public.center_members
  WHERE (center_members.user_id = auth.uid()))));

CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
