
-- 管理员口令：别人输错再多次，正确的口令也照样能用 ------------------------------
--
-- 原来 comment_admin_verdict 先数失败次数、再比对口令：全站 10 分钟内输错 10 次，
-- 接下来连正确的口令也只回 'throttled'。谁在 /admin 随手输 10 次错口令，就能把
-- 所有管理员锁在外面 10 分钟，包括现场主持页（live_host_* 每次轮询都校验口令）。
--
-- 现在先比对口令：
--   - 口令正确：永远返回 'ok'，不管最近输错了多少次。
--   - 口令不对：和原来一样，没到上限就记一次失败、返回 'denied'；到了上限返回
--     'throttled'，这时不再记录，免得有人刷请求把失败记录表撑大。
--
-- 这样限流就不再挡猜口令了（正确的那个总能通过，猜的人分得出对错），安全全靠口令
-- 本身。Vault 里的口令至少 24 位（短于 24 位这个功能直接关闭），而且必须随机生成，
-- 比如 openssl rand -hex 16（32 位）。哪怕只用小写字母和数字，24 位随机字符也有
-- 36^24 ≈ 10^37 种组合，每秒试一百万次也要 10^23 年以上才试得完一半，所以放行
-- 正确口令不会让暴力破解变得可行。不要用人能记住的句子或单词当口令。
--
-- 函数签名、security definer、search_path 和权限都和
-- 20261015060000_comment_owner_and_admin_delete.sql 一样，check_comment_admin、
-- delete_project_comment 和 live_host_* 都不用改。

-- 'ok' | 'denied' | 'throttled'. Never raises, so a failed attempt is recorded
-- instead of rolled back. The key is compared before the throttle, so the
-- right key always gets 'ok' however many wrong ones came before it.
create or replace function comment_admin_verdict(admin_key text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select decrypted_secret into expected
  from vault.decrypted_secrets where name = 'comment_admin_key' limit 1;
  if expected is not null and char_length(expected) >= 24
     and admin_key is not null and admin_key = expected then
    return 'ok';
  end if;
  if (select count(*) from comment_admin_attempts
      where not ok and at > now() - interval '10 minutes') >= 10 then
    return 'throttled';
  end if;
  insert into comment_admin_attempts (ok) values (false);
  return 'denied';
end;
$$;
revoke all on function comment_admin_verdict(text) from public, anon, authenticated;
