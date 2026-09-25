begin;

create or replace function public.apply_revenuecat_access_snapshot(
    p_user_id uuid,
    p_app_user_id text,
    p_original_app_user_id text,
    p_aliases jsonb,
    p_active_entitlement_ids text[],
    p_active_product_ids text[],
    p_access_expires_at timestamp with time zone,
    p_environment text,
    p_event_id text,
    p_event_type text,
    p_event_at timestamp with time zone
)
returns public.revenuecat_customer_access
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    entitlement_ids text[] :=
        coalesce(p_active_entitlement_ids, '{}'::text[]);
    product_ids text[] :=
        coalesce(p_active_product_ids, '{}'::text[]);
    has_bundle boolean := false;
    has_premium boolean := false;
    has_no_ads boolean := false;
    has_gold boolean := false;
    access_record public.revenuecat_customer_access;
begin
    if p_user_id is null then
        raise exception 'RevenueCat user UUID is required';
    end if;

    if not exists (
        select 1
        from auth.users
        where id = p_user_id
    ) then
        raise exception 'RevenueCat App User ID does not match a PolyOpen account';
    end if;

    if nullif(trim(coalesce(p_app_user_id, '')), '') is null then
        raise exception 'RevenueCat App User ID is required';
    end if;

    if nullif(trim(coalesce(p_event_id, '')), '') is null then
        raise exception 'RevenueCat event ID is required';
    end if;

    if not exists (
        select 1
        from public.revenuecat_webhook_events
        where event_id = p_event_id
    ) then
        raise exception 'RevenueCat event must be recorded before access synchronization';
    end if;

    has_bundle :=
        'premium_bundle' = any(entitlement_ids);

    has_premium :=
        has_bundle
        or 'premium' = any(entitlement_ids);

    has_no_ads :=
        has_bundle
        or 'no_ads' = any(entitlement_ids);

    has_gold :=
        has_bundle
        or 'verification' = any(entitlement_ids);

    insert into public.revenuecat_customer_access (
        user_id,
        app_user_id,
        original_app_user_id,
        aliases,
        active_entitlement_ids,
        active_product_ids,
        has_premium,
        has_no_ads,
        has_premium_bundle,
        has_gold_verification,
        access_expires_at,
        environment,
        last_event_id,
        last_event_type,
        last_event_at
    )
    values (
        p_user_id,
        trim(p_app_user_id),
        nullif(trim(coalesce(p_original_app_user_id, '')), ''),
        coalesce(p_aliases, '[]'::jsonb),
        entitlement_ids,
        product_ids,
        has_premium,
        has_no_ads,
        has_bundle,
        has_gold,
        p_access_expires_at,
        p_environment,
        p_event_id,
        p_event_type,
        p_event_at
    )
    on conflict (user_id)
    do update set
        app_user_id = excluded.app_user_id,
        original_app_user_id = excluded.original_app_user_id,
        aliases = excluded.aliases,
        active_entitlement_ids = excluded.active_entitlement_ids,
        active_product_ids = excluded.active_product_ids,
        has_premium = excluded.has_premium,
        has_no_ads = excluded.has_no_ads,
        has_premium_bundle = excluded.has_premium_bundle,
        has_gold_verification = excluded.has_gold_verification,
        access_expires_at = excluded.access_expires_at,
        environment = excluded.environment,
        last_event_id = excluded.last_event_id,
        last_event_type = excluded.last_event_type,
        last_event_at = excluded.last_event_at
    returning * into access_record;

    update public.profiles
    set
        is_premium = has_premium,
        no_ads = has_no_ads,
        premium_bundle = has_bundle,
        premium_tier = case
            when has_bundle then 'premium_no_ads_gold_bundle'
            when has_premium then 'premium_monthly'
            when has_no_ads then 'no_ads_monthly'
            when has_gold then 'gold_verification'
            else null
        end,
        premium_expires_at = case
            when has_bundle or has_premium or has_no_ads or has_gold
                then p_access_expires_at
            else null
        end,
        is_verified = has_gold,
        verification_tier = case
            when has_gold then 'gold'
            else null
        end,
        verification_status = case
            when has_gold then 'approved'
            else 'not_verified'
        end,
        verification_submitted_at = case
            when has_gold
                then coalesce(verification_submitted_at, now())
            else null
        end,
        verification_approved_at = case
            when has_gold
                then coalesce(verification_approved_at, now())
            else null
        end
    where id = p_user_id;

    if not found then
        raise exception 'PolyOpen profile was not found for RevenueCat customer';
    end if;

    update public.revenuecat_webhook_events
    set
        user_id = p_user_id,
        processed_at = now(),
        processing_error = null
    where event_id = p_event_id;

    return access_record;
end;
$$;

comment on function public.apply_revenuecat_access_snapshot(
    uuid,
    text,
    text,
    jsonb,
    text[],
    text[],
    timestamp with time zone,
    text,
    text,
    text,
    timestamp with time zone
) is
    'Applies a server-verified RevenueCat customer snapshot to PolyOpen paid access.';

revoke all on function public.apply_revenuecat_access_snapshot(
    uuid,
    text,
    text,
    jsonb,
    text[],
    text[],
    timestamp with time zone,
    text,
    text,
    text,
    timestamp with time zone
) from public;

revoke all on function public.apply_revenuecat_access_snapshot(
    uuid,
    text,
    text,
    jsonb,
    text[],
    text[],
    timestamp with time zone,
    text,
    text,
    text,
    timestamp with time zone
) from anon;

revoke all on function public.apply_revenuecat_access_snapshot(
    uuid,
    text,
    text,
    jsonb,
    text[],
    text[],
    timestamp with time zone,
    text,
    text,
    text,
    timestamp with time zone
) from authenticated;

grant execute on function public.apply_revenuecat_access_snapshot(
    uuid,
    text,
    text,
    jsonb,
    text[],
    text[],
    timestamp with time zone,
    text,
    text,
    text,
    timestamp with time zone
) to service_role;

commit;
