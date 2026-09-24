begin;

create table public.revenuecat_webhook_events (
    event_id text primary key,
    event_type text not null,
    user_id uuid references auth.users(id) on delete set null,
    app_user_id text,
    original_app_user_id text,
    product_id text,
    entitlement_ids text[] not null default '{}',
    environment text,
    event_timestamp_ms bigint,
    purchased_at timestamp with time zone,
    expiration_at timestamp with time zone,
    raw_event jsonb not null,
    received_at timestamp with time zone not null default now(),
    processed_at timestamp with time zone,
    processing_error text,
    constraint revenuecat_event_id_not_blank
        check (char_length(trim(event_id)) > 0),
    constraint revenuecat_event_type_not_blank
        check (char_length(trim(event_type)) > 0)
);

comment on table public.revenuecat_webhook_events is
    'Private idempotent event ledger for authenticated RevenueCat webhooks.';

comment on column public.revenuecat_webhook_events.raw_event is
    'Full private RevenueCat webhook event retained for billing reconciliation and audit.';

create index revenuecat_webhook_events_user_idx
    on public.revenuecat_webhook_events (
        user_id,
        received_at desc
    );

create index revenuecat_webhook_events_app_user_idx
    on public.revenuecat_webhook_events (
        app_user_id,
        received_at desc
    );

create index revenuecat_webhook_events_type_idx
    on public.revenuecat_webhook_events (
        event_type,
        received_at desc
    );

alter table public.revenuecat_webhook_events
    enable row level security;

revoke all on table public.revenuecat_webhook_events
    from public;

revoke all on table public.revenuecat_webhook_events
    from anon;

revoke all on table public.revenuecat_webhook_events
    from authenticated;

grant all on table public.revenuecat_webhook_events
    to service_role;

create table public.revenuecat_customer_access (
    user_id uuid primary key
        references auth.users(id)
        on delete cascade,
    app_user_id text not null unique,
    original_app_user_id text,
    aliases jsonb not null default '[]'::jsonb,
    active_entitlement_ids text[] not null default '{}',
    active_product_ids text[] not null default '{}',
    has_premium boolean not null default false,
    has_no_ads boolean not null default false,
    has_premium_bundle boolean not null default false,
    has_gold_verification boolean not null default false,
    access_expires_at timestamp with time zone,
    environment text,
    last_event_id text references public.revenuecat_webhook_events(event_id)
        on delete set null,
    last_event_type text,
    last_event_at timestamp with time zone,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint revenuecat_app_user_id_not_blank
        check (char_length(trim(app_user_id)) > 0)
);

comment on table public.revenuecat_customer_access is
    'Server-authoritative RevenueCat access snapshot keyed to a Supabase Auth user.';

comment on column public.revenuecat_customer_access.user_id is
    'Supabase Auth UUID. RevenueCat app_user_id must be configured with this same UUID.';

create index revenuecat_customer_access_expiration_idx
    on public.revenuecat_customer_access (
        access_expires_at
    );

create index revenuecat_customer_access_event_idx
    on public.revenuecat_customer_access (
        last_event_at desc
    );

alter table public.revenuecat_customer_access
    enable row level security;

revoke all on table public.revenuecat_customer_access
    from public;

revoke all on table public.revenuecat_customer_access
    from anon;

revoke all on table public.revenuecat_customer_access
    from authenticated;

grant all on table public.revenuecat_customer_access
    to service_role;

create policy "Members can read own RevenueCat access"
    on public.revenuecat_customer_access
    for select
    to authenticated
    using (user_id = auth.uid());

grant select on table public.revenuecat_customer_access
    to authenticated;

create or replace function public.set_revenuecat_access_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke all on function public.set_revenuecat_access_updated_at()
    from public;

revoke all on function public.set_revenuecat_access_updated_at()
    from anon;

revoke all on function public.set_revenuecat_access_updated_at()
    from authenticated;

grant execute on function public.set_revenuecat_access_updated_at()
    to service_role;

create trigger revenuecat_customer_access_updated_at
before update on public.revenuecat_customer_access
for each row
execute function public.set_revenuecat_access_updated_at();

commit;
