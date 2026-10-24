# 项目双语：手动翻译流程

项目卡（项目名、要解决的问题、目标用户、下一步）、进展时间线和评论都要有中英两种语言。访客用哪种语言写都行，另一种语言由运营补：用 AI 翻译，人工检查后写回数据库。暂时不做自动翻译。

数据库结构见迁移 `20261024000000_bilingual_content.sql`。

## 约定

- 主列（`name`、`problem`、`target_user`、`next_step`、`body`）放中文，`*_en` 列放英文。英文列为空时，英文页面显示主列。
- `original_lang` 记作者原来写的语言，填 `zh` 或 `en`。网站在另一种语言的页面上，给这条内容的右下角标一个灰色小字（英文页面标「Translated」，中文页面标「译文」）。
- 按作者写的语言分三种情况：
  - **只写了中文**：主列不动，英文写进 `*_en`，`original_lang = 'zh'`。
  - **只写了英文**：英文原文原样挪进 `*_en`，主列换成中文译文，`original_lang = 'en'`。
  - **同一格里中英都写了**：拆开，中文留在主列，英文放进 `*_en`，`original_lang` 留空（不标「Translated」）。
- 项目名两种语言一样时（比如 OFFERFOX），`name_en` 留空。
- 访客投稿和评论都写不了这几列，只有后台能写。

## 什么时候做

- 收到「新项目卡」或「待审核的进展」邮件时，审核的同时把翻译做了，翻完再改成 `approved`。这样项目一上线就是双语的。
- 评论不逐条发邮件。每天的汇总邮件里有新评论时，跑一遍下面的查询，评论会一起列出来。
- 改了已上线项目的中文以后，英文也要跟着改。最省事的办法是把 `problem_en` 清空，这个项目就会重新出现在待翻译列表里。

## 步骤

1. **导出**：打开 Supabase 后台的 SQL Editor，运行

   ```sql
   select * from translation_queue order by created_at;
   ```

   列出的是待审和已上线、但还没有英文版的项目卡和进展，以及公开项目下的评论。每行有表名 `tbl`、`id`、所属项目 `project` 和要翻译的字段 `fields`。把结果全部复制出来。

2. **AI 翻译**：把下面的提示词和复制出来的结果一起发给 Claude、ChatGPT 或豆包。

3. **人工检查**：
   - 每条 `update` 结尾都要有 `where id = '…'`，而且 id 和导出的一致。没有 `where` 的语句不要运行，它会改掉整张表。
   - 意思对不对，专有名词对不对。拿不准的地方保留原文。
   - 英文原稿的那几条，`*_en` 里是不是作者原文，一字没改。
   - 文字里不能出现 `$$`。

4. **写回**：把 SQL 粘到 SQL Editor 里运行。只改一两个字的话，也可以在 Table Editor 里直接点开格子改。待审的项目确认没问题后，把 `review_status` 改成 `approved`（也可以在同一段 SQL 里加一句 `update projects set review_status = 'approved' where id = '…';`）。

5. **核对**：页面缓存几分钟，稍等一会儿打开 `https://www.builderspace.dev/projects/<slug>`，用右上角的「中 / EN」切换，两种语言各看一遍，确认右下角的小字只出现在翻译的那一边。

## 提示词

```text
你在帮 BuilderSpace 社团官网把项目卡、项目进展和评论做成中英双语。下面是从数据库导出的待翻译内容，每行有 tbl（表名）、id 和 fields（要翻译的字段）。

规则：
1. 只翻译，不扩写、不删减、不改观点；语气保持原样，口语就译成口语。
2. 品牌名、产品名、昵称和技术名词（如 Claude Code、DSH、Windows）保留原文。
3. 原文是中文：主列不动，英文写进对应的 _en 列，original_lang = 'zh'。
4. 原文是英文：中文译文写进主列，英文原文一字不改地放进 _en 列，original_lang = 'en'。
5. 同一个字段里中英文都有：中文部分留在主列，英文部分放进 _en 列，original_lang = null。
6. 项目名两种语言一样时，name_en = null。
7. 评论开头的「@昵称」在两种语言里都原样保留。
8. 长度上限：主列 name 60、problem 280、target_user 80、next_step 280、body 500 个字；英文列 name_en 180、problem_en 840、target_user_en 240、next_step_en 840、body_en 1500 个字符。
9. 只输出 SQL，一行一条 update，按 id 定位，文字一律用 $$…$$ 包起来。fields 里没有的字段不要写进 set。格式例如：
update projects set name_en = $$…$$, problem_en = $$…$$, target_user_en = $$…$$, next_step_en = $$…$$, original_lang = 'zh' where id = '…';
update project_updates set body_en = $$…$$, original_lang = 'zh' where id = '…';
update project_comments set body = $$中文译文$$, body_en = $$English original$$, original_lang = 'en' where id = '…';

待翻译内容：
（把查询结果粘在这里）
```
