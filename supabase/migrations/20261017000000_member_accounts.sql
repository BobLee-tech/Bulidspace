-- 成员账号：邮箱 6 位验证码登录，每人一张成员卡 ----------------------------
-- 1. 编号用真实的加入顺序：join_submissions 按提交时间回填 member_no，第一个
--    加入的人是 No. 1；之后每条新记录从同一个序列取号，号码一旦给出就不再变，
--    删掉某条记录也不会让后面的人改号。
-- 2. profiles：登录后的成员资料，编号从对应的 join_submissions 行复制过来。
--    用户只能改自己的资料，而且只能改展示类字段；编号、学校认证这些只由
--    join_builderspace() 在服务端写入。
-- 3. join_builderspace()：登录后的「生成我的卡片」。一个事务里写 join 记录和
--    profile，学校邮箱从已验证的登录邮箱判断，不信任前端传来的值。
-- 4. save_join_survey()：卡片生成后选填的问卷，写回同一条 join 记录。
--
-- 跑之前：join_submissions 里的测试数据和重复提交先删掉，否则也会占号。

-- 加入顺序 ---------------------------------------------------------------
create sequence if not exists member_no_seq;

alter table join_submissions
  add column member_no int,
  add column user_id uuid references auth.users (id) on delete set null;

with ordered as (
  select id, row_number() over (order by created_at, id) as n
  from join_submissions
)
update join_submissions j set member_no = o.n from ordered o where o.id = j.id;

select setval(
  'member_no_seq',
  greatest((select coalesce(max(member_no), 0) from join_submissions), 1),
  (select count(*) > 0 from join_submissions)
);

alter table join_submissions
  alter column member_no set default nextval('member_no_seq'),
  alter column member_no set not null,
  add constraint join_submissions_member_no_key unique (member_no);

alter sequence member_no_seq owned by join_submissions.member_no;

create unique index join_submissions_user_id_key
  on join_submissions (user_id) where user_id is not null;

-- 新的加入流程不再问每周投入和渠道（渠道放进选填问卷），技能换成细分后的 13 项；
-- 旧的 5 项继续接受，老记录不受影响。
alter table join_submissions
  alter column weekly_hours drop not null,
  alter column referral_source drop not null,
  drop constraint join_submissions_skills_check,
  add constraint join_submissions_skills_check check (skills <@ array[
    'frontend', 'backend', 'design', 'product', 'beginner',
    'web', 'mobile', 'ai', 'hw', 'uiux', 'visual', 'motion', 'growth', 'biz', 'content', 'newbie'
  ]);

-- 成员资料 ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  member_no int not null unique,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{1,31}$'),
  nickname text not null check (char_length(nickname) between 1 and 20),
  school_degree text not null default '' check (char_length(school_degree) <= 80),
  major text not null default '' check (char_length(major) <= 80),
  skills text[] not null default '{}' check (
    cardinality(skills) <= 4
    and skills <@ array[
      'web', 'backend', 'mobile', 'ai', 'hw', 'uiux', 'visual', 'motion',
      'product', 'growth', 'biz', 'content', 'newbie'
    ]
  ),
  spark text not null check (spark in ('vivi', 'lumi', 'geo', 'momo', 'kiko')),
  building text check (char_length(building) between 1 and 40),
  looking_for text[] not null default '{}' check (
    cardinality(looking_for) <= 3
    and looking_for <@ array['design', 'dev', 'product', 'team', 'learn', 'friends']
  ),
  -- 只有登录邮箱是学校邮箱时才有值；认证时间由服务端写，用户改不了。
  school_domain text,
  school_verified_at timestamptz,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

alter table profiles enable row level security;

create policy "members read their own profile" on profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "members edit their own profile" on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 公开卡片页上线前（P2），匿名访客读不到任何资料。
revoke all on profiles from anon, authenticated;
grant select on profiles to authenticated;
grant update (nickname, school_degree, major, skills, spark, building, looking_for, is_public)
  on profiles to authenticated;

-- 生成成员卡 -------------------------------------------------------------
create or replace function join_builderspace(
  p_nickname text,
  p_school_degree text,
  p_major text,
  p_skills text[],
  p_spark text,
  p_building text,
  p_looking_for text[],
  p_channel text
) returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  domain text := split_part(mail, '@', 2);
  is_school boolean := domain ~ '(^|\.)(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$';
  join_id uuid;
  no int;
  base text;
  pick text;
  result profiles;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;

  -- 已经生成过：直接返回，重复点按钮不会多占号。
  select * into result from profiles where id = uid;
  if found then
    return result;
  end if;

  -- 老成员认领时，运营会先把 join_submissions.user_id 填上，他们拿回原来的号。
  select id, member_no into join_id, no from join_submissions where user_id = uid;
  if join_id is null then
    insert into join_submissions (nickname, school_degree, major, skills, idea, channel, user_id)
    values (
      p_nickname,
      coalesce(p_school_degree, ''),
      coalesce(p_major, ''),
      coalesce(p_skills, '{}'),
      nullif(trim(coalesce(p_building, '')), ''),
      p_channel,
      uid
    )
    returning id, member_no into join_id, no;
  end if;

  -- 公开链接用的短名：昵称里的英文数字，取不到就用编号。
  base := trim(both '-' from regexp_replace(lower(p_nickname), '[^a-z0-9]+', '-', 'g'));
  base := left(base, 24);
  if char_length(base) < 2 then
    base := 'builder-' || no;
  end if;
  pick := base;
  if exists (select 1 from profiles where handle = pick) then
    pick := left(base, 20) || '-' || no;
  end if;

  insert into profiles (
    id, member_no, handle, nickname, school_degree, major, skills, spark,
    building, looking_for, school_domain, school_verified_at
  ) values (
    uid, no, pick, p_nickname, coalesce(p_school_degree, ''), coalesce(p_major, ''),
    coalesce(p_skills, '{}'), p_spark, nullif(trim(coalesce(p_building, '')), ''),
    coalesce(p_looking_for, '{}'),
    case when is_school then domain end,
    case when is_school then now() end
  )
  returning * into result;

  return result;
end;
$$;

-- 选填问卷：原加入表单的后半部分，写回本人的 join 记录 ----------------------
create or replace function save_join_survey(
  p_stalled_project boolean,
  p_blockers text[],
  p_referral_source text,
  p_next_event_interest text,
  p_showcase_consent boolean,
  p_affiliation_support boolean,
  p_full_name text,
  p_zid text,
  p_affiliation_consent boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  update join_submissions set
    stalled_project = p_stalled_project,
    blockers = coalesce(p_blockers, '{}'),
    referral_source = p_referral_source,
    next_event_interest = p_next_event_interest,
    showcase_consent = coalesce(p_showcase_consent, false),
    affiliation_support = coalesce(p_affiliation_support, false),
    full_name = case when p_affiliation_support then p_full_name end,
    zid = case when p_affiliation_support then p_zid end,
    affiliation_consent = coalesce(p_affiliation_support, false) and coalesce(p_affiliation_consent, false)
  where user_id = uid;
  if not found then
    raise exception 'no join record for this member' using errcode = 'P0002';
  end if;
end;
$$;

-- 问卷是否填过，只给本人看：不把 join 记录整行开放给 API。
create or replace function my_join_survey_done() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select referral_source is not null or stalled_project is not null
     from join_submissions where user_id = auth.uid()),
    false
  );
$$;

revoke all on function join_builderspace(text, text, text, text[], text, text, text[], text) from public, anon;
revoke all on function save_join_survey(boolean, text[], text, text, boolean, boolean, text, text, boolean) from public, anon;
revoke all on function my_join_survey_done() from public, anon;
revoke all on function touch_updated_at() from public, anon, authenticated;
grant execute on function join_builderspace(text, text, text, text[], text, text, text[], text) to authenticated;
grant execute on function save_join_survey(boolean, text[], text, text, boolean, boolean, text, text, boolean) to authenticated;
grant execute on function my_join_survey_done() to authenticated;

-- Hub 后台能看到每条加入记录的编号和是否已开通账号（只读）。
grant select on profiles to hub_site_admin;
drop policy if exists "hub reads profiles" on profiles;
create policy "hub reads profiles" on profiles
  for select to hub_site_admin using (true);
