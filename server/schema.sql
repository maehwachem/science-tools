-- 과학 수업 도구 · 제출 서버 (Supabase)
--
-- 학생 이름은 서버에 두지 않는다. 학생은 선생님이 나눠 준 6자리 개인 코드로만 구분하고,
-- 코드와 이름을 짝지은 명단은 선생님 기기(와 선생님이 따로 보관하는 명단 파일)에만 둔다.
--
-- 학생 기기: 로그인 없이 submit_record(), class_info() 두 함수만 부를 수 있다. 표는 읽지도 쓰지도 못한다.
-- 선생님:    교사 명단(teachers)에 있는 계정으로 로그인해 자기 수업만 만들고, 읽고, 지운다.
--
-- Supabase SQL Editor에서 한 번 실행한다. 자세한 설명은 server/README.md.

-- ───────── 수업 번호 만들기 ─────────
-- 헷갈리는 글자(0 O 1 I L)를 뺀 31글자 중 8글자. 약 8.5×10^11가지라 짐작으로 맞히기 어렵다.
create or replace function public.new_class_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  idx constant int[] := array[0, 1, 2, 3, 4, 5, 10, 11];   -- 버전·변형 비트가 있는 6, 8번 바이트는 피한다
  c text := '';
  i int;
begin
  foreach i in array idx loop
    c := c || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return c;
end $$;

-- ───────── 표 ─────────
-- 교사 명단: 여기에 있는 계정만 수업을 만들 수 있다. 관리자가 SQL로 직접 넣는다 (README 참고).
create table if not exists public.teachers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- 수업: 반 하나, 학기 하나 정도의 단위. 여러 도구의 제출을 한 수업으로 받을 수 있다.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references public.teachers (id) on delete cascade,
  code text not null unique default public.new_class_code(),
  title text not null check (char_length(title) between 1 and 60),       -- 예: '2학년 3반 2학기'. 학생 정보는 넣지 않는다
  tools text[] not null default '{}',                                     -- 비어 있으면 모든 도구에서 제출 가능
  open boolean not null default true,                                     -- 끄면 제출을 받지 않는다
  closes_at timestamptz,                                                  -- 이때부터 제출을 받지 않는다
  delete_after date not null default (current_date + 180),               -- 이 날짜가 지나면 수업과 제출을 모두 지운다
  created_at timestamptz not null default now()
);
create index if not exists classes_teacher_idx on public.classes (teacher_id);

-- 수업 구성원: 개인 코드만 둔다. 이름 칸은 일부러 없다.
create table if not exists public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  primary key (class_id, code)
);

-- 제출: 도구가 만든 기록(과정 기록, 측정값, 답, 실수 분석)을 그대로 담는다.
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  member_codes text[] not null check (cardinality(member_codes) between 1 and 6),   -- 개별은 1개, 조별은 조원 코드
  tool text not null check (tool ~ '^[a-z0-9-]{2,40}$'),                          -- 예: 'acid-base-lab'
  record_id text not null check (char_length(record_id) between 4 and 64),        -- 같은 기록을 두 번 내면 하나만 남긴다
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (class_id, record_id)
);
create index if not exists submissions_class_idx on public.submissions (class_id, created_at desc);

-- 틀린 코드로 낸 제출: 코드를 마구 넣어 보는 것을 막는 데만 쓴다. 하루 지나면 지운다.
create table if not exists public.submit_failures (
  class_id uuid not null references public.classes (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists submit_failures_idx on public.submit_failures (class_id, at);

-- ───────── 접근 규칙 ─────────
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.submissions enable row level security;
alter table public.submit_failures enable row level security;

-- 로그인하지 않은 학생 기기(anon)는 표에 아무 권한이 없다. 함수로만 들어온다.
revoke all on public.teachers, public.classes, public.class_members, public.submissions, public.submit_failures from anon;
-- 로그인한 계정도 교사 명단과 실패 기록은 함수 밖에서 고칠 수 없다.
revoke insert, update, delete on public.teachers from authenticated;
revoke all on public.submit_failures from authenticated;
-- 제출은 함수로만 들어오고, 들어온 제출은 고칠 수 없다 (지우기만 가능).
revoke insert, update on public.submissions from authenticated;

drop policy if exists "teacher reads self" on public.teachers;
create policy "teacher reads self" on public.teachers
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "own classes" on public.classes;
create policy "own classes" on public.classes
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));          -- teacher_id가 교사 명단을 가리켜야 하므로(외래 키) 명단 밖 계정은 만들 수 없다

drop policy if exists "members of own classes" on public.class_members;
create policy "members of own classes" on public.class_members
  for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));

drop policy if exists "read own submissions" on public.submissions;
create policy "read own submissions" on public.submissions
  for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));

drop policy if exists "delete own submissions" on public.submissions;
create policy "delete own submissions" on public.submissions
  for delete to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));

-- ───────── 학생 기기가 부르는 함수 ─────────
-- 수업 번호로 수업 이름과 제출 가능 여부를 확인한다 (학생 화면에 '2학년 3반 2학기에 제출' 같은 안내용).
create or replace function public.class_info(p_class text)
returns table (title text, tools text[], open boolean)
language sql stable security definer set search_path = '' as $$
  select c.title, c.tools, (c.open and (c.closes_at is null or c.closes_at > now()))
  from public.classes c
  where c.code = upper(trim(p_class));
$$;

-- 기록 하나를 낸다. 돌려주는 값:
--   ok, duplicate(이미 냄), no_class, closed, wrong_tool, unknown_member(명단에 없는 코드),
--   too_many(이 수업에 틀린 코드가 10분 동안 100번 넘게 들어옴), too_big(256 KB 넘음), full(수업당 5000건), bad_input
create or replace function public.submit_record(p_class text, p_codes text[], p_tool text, p_record_id text, p_payload jsonb)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.classes%rowtype;
  n int;
begin
  select * into c from public.classes where code = upper(trim(p_class));
  if not found then return 'no_class'; end if;
  if not c.open or (c.closes_at is not null and c.closes_at <= now()) then return 'closed'; end if;
  if cardinality(c.tools) > 0 and not (p_tool = any (c.tools)) then return 'wrong_tool'; end if;

  select count(*) into n from public.submit_failures f where f.class_id = c.id and f.at > now() - interval '10 minutes';
  if n >= 100 then return 'too_many'; end if;

  if p_codes is null or not (cardinality(p_codes) between 1 and 6)
     or exists (select 1 from unnest(p_codes) x
                where not exists (select 1 from public.class_members m where m.class_id = c.id and m.code = x)) then
    insert into public.submit_failures (class_id) values (c.id);
    return 'unknown_member';
  end if;

  if p_payload is null or octet_length(p_payload::text) > 262144 then return 'too_big'; end if;
  select count(*) into n from public.submissions s where s.class_id = c.id;
  if n >= 5000 then return 'full'; end if;

  begin
    insert into public.submissions (class_id, member_codes, tool, record_id, payload)
    values (c.id, p_codes, p_tool, p_record_id, p_payload)
    on conflict (class_id, record_id) do nothing;
    if not found then return 'duplicate'; end if;
  exception when check_violation or not_null_violation or string_data_right_truncation then
    return 'bad_input';
  end;
  return 'ok';
end $$;

-- 실험을 시작할 때 개인 코드를 미리 확인한다. 돌려주는 값: ok, no_class, closed, unknown_member, too_many
-- 틀린 코드는 submit_record와 같은 실패 기록에 쌓여, 코드를 마구 넣어 보는 것을 함께 막는다.
create or replace function public.check_member(p_class text, p_code text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.classes%rowtype;
  n int;
begin
  select * into c from public.classes where code = upper(trim(p_class));
  if not found then return 'no_class'; end if;
  if not c.open or (c.closes_at is not null and c.closes_at <= now()) then return 'closed'; end if;
  select count(*) into n from public.submit_failures f where f.class_id = c.id and f.at > now() - interval '10 minutes';
  if n >= 100 then return 'too_many'; end if;
  if exists (select 1 from public.class_members m where m.class_id = c.id and m.code = p_code) then return 'ok'; end if;
  insert into public.submit_failures (class_id) values (c.id);
  return 'unknown_member';
end $$;

-- ───────── 정리 ─────────
-- 보관 기한이 지난 수업(제출 포함)과 하루 지난 실패 기록을 지운다. 돌려주는 값: 지운 수업 수.
create or replace function public.purge_expired()
returns int
language plpgsql volatile security definer set search_path = '' as $$
declare n int;
begin
  delete from public.submit_failures where at < now() - interval '1 day';
  with d as (delete from public.classes where delete_after < current_date returning 1)
  select count(*)::int into n from d;
  return n;
end $$;

-- ───────── 함수 실행 권한 ─────────
revoke all on function public.new_class_code() from public, anon;
grant execute on function public.new_class_code() to authenticated;            -- 수업을 만들 때 기본값으로 쓰인다
revoke all on function public.class_info(text) from public;
grant execute on function public.class_info(text) to anon, authenticated;
revoke all on function public.submit_record(text, text[], text, text, jsonb) from public;
grant execute on function public.submit_record(text, text[], text, text, jsonb) to anon, authenticated;
revoke all on function public.check_member(text, text) from public;
grant execute on function public.check_member(text, text) to anon, authenticated;
revoke all on function public.purge_expired() from public, anon, authenticated;  -- 관리자와 예약 작업만

-- pg_cron을 켰다면 (Database → Extensions → pg_cron) 아래 한 줄로 매일 새벽 3시(한국 시각)에 정리한다.
-- select cron.schedule('purge-expired-classes', '0 18 * * *', 'select public.purge_expired()');
