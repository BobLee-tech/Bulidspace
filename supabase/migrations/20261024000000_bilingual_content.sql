-- 项目卡、进展和评论的中英双语 ------------------------------------------------
-- 访客用哪种语言写都行，运营审核时用 AI 翻译、人工检查后补上另一种语言，
-- 流程和提示词见 docs/translation.md。
--
-- 约定：主列（name、problem、target_user、next_step、body）放中文，*_en 放英文；
-- 英文列为空时英文页面显示主列。original_lang 记作者原来写的语言，网站在另一种
-- 语言的页面上给这条内容标一个灰色小字「Translated / 译文」；作者两种语言都写了
-- 或还没翻译时为空。英文比中文长，英文列的上限是中文列的 3 倍。
--
-- 访客写不了这些列：项目卡和进展用 RLS 挡（它们是表级 insert 权限），评论本来就
-- 只授权了访客能写的那几列。

alter table projects
  add column name_en text check (char_length(name_en) between 1 and 180),
  add column problem_en text check (char_length(problem_en) between 1 and 840),
  add column target_user_en text check (char_length(target_user_en) between 1 and 240),
  add column next_step_en text check (char_length(next_step_en) between 1 and 840),
  add column original_lang text check (original_lang in ('zh', 'en'));

alter table project_updates
  add column body_en text check (char_length(body_en) between 1 and 1500),
  add column original_lang text check (original_lang in ('zh', 'en'));

alter table project_comments
  add column body_en text check (char_length(body_en) between 1 and 1500),
  add column original_lang text check (original_lang in ('zh', 'en'));

drop policy "public submits project drafts" on projects;
create policy "public submits project drafts" on projects
  for insert to anon, authenticated with check (
    review_status = 'pending'
    and name_en is null and problem_en is null and target_user_en is null
    and next_step_en is null and original_lang is null
  );

drop policy "public submits pending updates to approved projects" on project_updates;
create policy "public submits pending updates to approved projects" on project_updates
  for insert to anon, authenticated with check (
    review_status = 'pending'
    and body_en is null and original_lang is null
    and exists (select 1 from projects p where p.id = project_id and p.review_status = 'approved')
  );

-- 待翻译：待审和已上线的项目卡、进展，以及公开项目下没删的评论里，还没有英文版的。
-- 运营在 SQL Editor 跑 `select * from translation_queue order by created_at;`，
-- 把结果交给 AI。项目卡看 problem_en（必填项的英文）是否为空。
create view translation_queue with (security_invoker = true) as
select 'projects' as tbl, p.id, p.slug as project, p.review_status::text as review_status,
  jsonb_strip_nulls(jsonb_build_object(
    'name', p.name, 'problem', p.problem, 'target_user', p.target_user, 'next_step', p.next_step
  )) as fields,
  p.created_at
from projects p
where p.review_status in ('pending', 'approved') and p.problem_en is null
union all
select 'project_updates', u.id, p.slug, u.review_status::text,
  jsonb_build_object('body', u.body), u.created_at
from project_updates u
join projects p on p.id = u.project_id and p.review_status = 'approved'
where u.review_status in ('pending', 'approved') and u.body_en is null
union all
select 'project_comments', c.id, p.slug, null::text,
  jsonb_build_object('body', c.body), c.created_at
from project_comments c
join projects p on p.id = c.project_id and p.review_status = 'approved'
where c.deleted_at is null and c.body_en is null;

-- Back office only, like project_activity.
revoke all on translation_queue from anon, authenticated;

-- The Data API caches the schema; make it pick up the new columns now.
notify pgrst, 'reload schema';
