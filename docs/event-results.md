# 活动成果：每场活动结束后怎么放上官网

活动结束后，活动页的介绍下面会出现「活动成果」区，按顺序是一句话回顾、几个数字和个人成果墙。哪一块没填，那一块就不显示。「当天用到」「离场时你会有」「带上」这几块挪到成果下面。活动列表 `/events` 里有成果的往期活动可以点进活动页，并带一个「N 个作品」标签。

- 数据：`src/lib/event-results.ts`，按活动 slug 分段
- 截图：`public/events/<slug>/`
- 显示：`src/app/events/[slug]/results.tsx`

成果墙只放本人同意展示的网站，名字按本人同意的写法原样显示，不翻译。

## 步骤

1. **活动当天**：在 Hub 复制上一场的「交作品」表单，改好标题，截止时间设在活动后 7 天。表单里要问清楚两件事：能不能放上官网，署什么名字。现场「交网址」环节勾了同意的网址也算候选。勾选项 2026-10-24 改成了「放上大屏和官网成果墙」，在这之前现场勾的只同意了大屏，要放上官网得再问本人。
2. **截止后导出**：在 Hub 表单页导出 CSV。现场交的网址在 Supabase 的 SQL Editor 里用下面这条只读查询导出，只查名字、网址和是否同意，不查 zID 和联系方式：

   ```sql
   select r.full_name as 名字,
          x.payload->>'url' as 网址,
          x.on_wall as 同意上墙,
          x.hidden as 主持人隐藏,
          to_char(x.created_at at time zone 'Australia/Sydney', 'MM-DD HH24:MI') as 交的时间
   from event_live_responses x
   join event_registrations r on r.id = x.registration_id
   join events e on e.id = x.event_id
   where e.slug = '<slug>' and x.step = 'link'
   order by x.created_at;
   ```

3. **合并去重**：同一个人现场和表单都交了的，按名字和 GitHub 用户名合成一条，用最新的那个网址。只留同意展示的人。逐个打开网址，打不开的先不放，私信提醒本人，修好了再补。
4. **截图**：每个网站截首屏，尺寸 1280×800，像素比 1。在 Chrome 里打开开发者工具，切到设备工具栏，尺寸填 1280×800，然后用命令面板（⌘⇧P）的 Capture screenshot。存成 JPEG，质量 75 左右，单张 200 KB 以内，文件名用 GitHub 用户名，例如 `public/events/<slug>/pbr2002.jpg`。有开场动画的网站，等文字出来再截。截完逐张看一眼。Hub 表单里本人上传的截图链接不是公开的，不能直接引用；要用的话，用 Hub 账号下载下来再放进来。
5. **填数据**：在 `src/lib/event-results.ts` 里给这场加一段，写上回顾句、报名和到场人数、名单，名单按交的时间排序。「上墙」的数字按名单自动计算。组织者的网站标 `organiser: true`，排在最后，不算进上墙数。
6. **发版**：跑 `pnpm check`，测试会检查截图文件是否存在、网址是否是 https、有没有重复。本地预览看一眼中英两种语言，开 PR，等 Bob 合并。上线后把活动页链接发到群里。
7. **撤下或补人**：删掉或加上对应的那条和截图，再开一个 PR。

一场活动大约要 30 分钟。以后活动多了，或者要交给不写代码的人维护，可以改成 Supabase 表，加上 Hub 的「同步到官网」按钮。现在的字段就是照着那张表的列来定的。
