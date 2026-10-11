-- Security floor: rollback never makes internal trigger functions callable.
begin;
revoke execute on function public.link_joint_work_to_execution() from public, anon, authenticated;
revoke execute on function public.block_submit_with_open_joint_work() from public, anon, authenticated;
commit;
