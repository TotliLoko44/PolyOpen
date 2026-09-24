begin;

create or replace function public.claim_weekly_premium_boost(
    p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_user_id uuid;
    has_paid_access boolean := false;
    has_vip_membership boolean := false;
    week_start_value date;
begin
    current_user_id := auth.uid();

    if current_user_id is null or current_user_id <> p_user_id then
        return jsonb_build_object(
            'success', false,
            'message', 'Authentication required'
        );
    end if;

    select
        (
            coalesce(profile_record.is_premium, false)
            or coalesce(profile_record.premium_bundle, false)
        )
        and (
            profile_record.premium_expires_at is null
            or profile_record.premium_expires_at > now()
        )
    into has_paid_access
    from public.profiles as profile_record
    where profile_record.id = current_user_id;

    has_vip_membership :=
        public.has_vip_access(current_user_id);

    if not coalesce(has_paid_access, false)
       and not coalesce(has_vip_membership, false) then
        return jsonb_build_object(
            'success', false,
            'message', 'Premium or VIP access required'
        );
    end if;

    week_start_value :=
        date_trunc('week', now())::date;

    insert into public.premium_weekly_boost_claims (
        user_id,
        week_start
    )
    values (
        current_user_id,
        week_start_value
    )
    on conflict do nothing;

    if not found then
        return jsonb_build_object(
            'success', false,
            'message', 'Already claimed'
        );
    end if;

    insert into public.user_boosts (
        user_id,
        boost_credits
    )
    values (
        current_user_id,
        1
    )
    on conflict (user_id)
    do update set
        boost_credits =
            user_boosts.boost_credits + 1;

    return jsonb_build_object(
        'success', true,
        'message', 'Boost added'
    );
end;
$$;

revoke all on function public.claim_weekly_premium_boost(uuid)
    from public;

revoke all on function public.claim_weekly_premium_boost(uuid)
    from anon;

grant execute on function public.claim_weekly_premium_boost(uuid)
    to authenticated;

revoke all on function public.is_vip_admin(uuid)
    from public;

revoke all on function public.is_vip_admin(uuid)
    from anon;

grant execute on function public.is_vip_admin(uuid)
    to authenticated;

revoke all on function public.has_vip_access(uuid)
    from public;

revoke all on function public.has_vip_access(uuid)
    from anon;

grant execute on function public.has_vip_access(uuid)
    to authenticated;

revoke all on function public.admin_grant_vip(uuid, text)
    from public;

revoke all on function public.admin_grant_vip(uuid, text)
    from anon;

grant execute on function public.admin_grant_vip(uuid, text)
    to authenticated;

revoke all on function public.admin_revoke_vip(uuid, text)
    from public;

revoke all on function public.admin_revoke_vip(uuid, text)
    from anon;

grant execute on function public.admin_revoke_vip(uuid, text)
    to authenticated;

comment on function public.claim_weekly_premium_boost(uuid) is
    'Claims one weekly boost for current Premium, bundle, or VIP members.';

commit;
