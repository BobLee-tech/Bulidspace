-- 卡片工坊：每位成员一张卡片的外观设计 ----------------------------------------
-- 材质、颜色、纹样只能取固定的几种值；五色全息（holo）和阳极钛（ti）以及校园
-- 贴纸（id 以 campus- 开头）只给学校邮箱认证过的成员，由触发器检查，前端
-- 改不了。贴纸存成 jsonb 数组，最多 6 张，每张的位置、角度、大小都有范围。
-- 只有本人能读写自己的卡片；公开卡片页（P2）上线时再给匿名访客开读权限。
-- 依赖 20261017000000_member_accounts.sql（profiles、touch_updated_at）。

-- 一张贴纸：{ id, x, y, r, s, f }。x / y 是在卡面上的百分比位置，r 是角度，
-- s 是缩放，f 是质感（原色 / 铬 / 全息）。
create or replace function member_card_stickers_valid(s jsonb) returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  e jsonb;
  k text;
begin
  if jsonb_typeof(s) is distinct from 'array' or jsonb_array_length(s) > 6 then
    return false;
  end if;
  for e in select value from jsonb_array_elements(s) loop
    if jsonb_typeof(e) <> 'object'
      or (select count(*) from jsonb_object_keys(e)) > 6
      or coalesce(e ->> 'id', '') !~ '^[a-z0-9-]{1,32}$'
      or coalesce(e ->> 'f', 'orig') not in ('orig', 'chrome', 'holo') then
      return false;
    end if;
    -- Types first, so the casts below can't fail.
    foreach k in array array['x', 'y', 'r', 's'] loop
      if jsonb_typeof(e -> k) is distinct from 'number' then
        return false;
      end if;
    end loop;
    if (e ->> 'x')::numeric not between 0 and 100
      or (e ->> 'y')::numeric not between 0 and 100
      or (e ->> 'r')::numeric not between -180 and 180
      or (e ->> 's')::numeric not between 0.25 and 2.4 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table member_cards (
  user_id uuid primary key references profiles (id) on delete cascade,
  material text not null default 'steel'
    check (material in ('steel', 'chrome', 'carbon', 'glass', 'holo', 'ti')),
  tint text not null default 'none'
    check (tint in ('none', 'vivi', 'lumi', 'geo', 'momo', 'kiko')),
  pattern text not null default 'guil'
    check (pattern in ('guil', 'puzzle', 'grid', 'topo', 'dots', 'none')),
  tagline text not null default '' check (char_length(tagline) <= 32),
  stickers jsonb not null default '[]'::jsonb
    check (member_card_stickers_valid(stickers)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger member_cards_touch before update on member_cards
  for each row execute function touch_updated_at();

-- 认证专属：五色全息、阳极钛和校园贴纸。认证状态只看 profiles.school_verified_at，
-- 那一列只有 join_builderspace() 能写。
create or replace function member_cards_verified_only() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.material in ('holo', 'ti')
    or (
      -- A malformed value is left for the check constraint to reject.
      jsonb_typeof(new.stickers) = 'array'
      and jsonb_path_exists(new.stickers, '$[*] ? (@.id starts with "campus-")')
    )
  ) and not exists (
    select 1 from profiles
    where id = new.user_id and school_verified_at is not null
  ) then
    raise exception 'holo, titanium and campus stickers are for verified members'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger member_cards_verified_only before insert or update on member_cards
  for each row execute function member_cards_verified_only();

alter table member_cards enable row level security;

create policy "members read their own card" on member_cards
  for select to authenticated using (user_id = (select auth.uid()));

create policy "members create their own card" on member_cards
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "members edit their own card" on member_cards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 新表不会自动授权给 API 角色，逐列写清楚。
revoke all on member_cards from anon, authenticated;
grant select on member_cards to authenticated;
grant insert (user_id, material, tint, pattern, tagline, stickers)
  on member_cards to authenticated;
grant update (material, tint, pattern, tagline, stickers)
  on member_cards to authenticated;

revoke all on function member_cards_verified_only() from public, anon, authenticated;
