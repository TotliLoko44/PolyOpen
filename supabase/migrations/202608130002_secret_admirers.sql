begin;

create table if not exists public.secret_admirers (
    id uuid primary key default gen_random_uuid(),
    admirer_id uuid not null references public.profiles(id) on delete cascade,
    admired_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),

    constraint secret_admirers_no_self
        check (admirer_id <> admired_id),

    constraint secret_admirers_unique_pair
        unique (admirer_id, admired_id)
);

create index if not exists secret_admirers_admirer_idx
    on public.secret_admirers(admirer_id);

create index if not exists secret_admirers_admired_idx
    on public.secret_admirers(admired_id);

alter table public.secret_admirers
    enable row level security;

drop policy if exists
    "secret_admirers_insert_own"
    on public.secret_admirers;

create policy
    "secret_admirers_insert_own"
    on public.secret_admirers
    for insert
    to authenticated
    with check (
        auth.uid() = admirer_id
    );

drop policy if exists
    "secret_admirers_sender_read"
    on public.secret_admirers;

create policy
    "secret_admirers_sender_read"
    on public.secret_admirers
    for select
    to authenticated
    using (
        auth.uid() = admirer_id
    );

drop policy if exists
    "secret_admirers_sender_delete"
    on public.secret_admirers;

create policy
    "secret_admirers_sender_delete"
    on public.secret_admirers
    for delete
    to authenticated
    using (
        auth.uid() = admirer_id
    );

create or replace function public.get_my_secret_admirers()
returns table (
    secret_admirer_id uuid,
    admirer_id uuid,
    created_at timestamptz,
    identity_unlocked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    premium_access boolean := false;
begin
    select
        coalesce(p.is_premium, false)
        or coalesce(p.premium_bundle, false)
    into premium_access
    from public.profiles p
    where p.id = auth.uid();

    return query
    select
        sa.id,
        case
            when premium_access then sa.admirer_id
            else null::uuid
        end,
        sa.created_at,
        premium_access
    from public.secret_admirers sa
    where sa.admired_id = auth.uid()
    order by sa.created_at desc;
end;
$$;

revoke all on function public.get_my_secret_admirers()
    from public;

grant execute on function public.get_my_secret_admirers()
    to authenticated;

create or replace function public.send_secret_admirer(
    target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_user_id uuid := auth.uid();
    admirer_row public.secret_admirers%rowtype;
begin
    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    if target_user_id is null then
        raise exception 'Target member required';
    end if;

    if current_user_id = target_user_id then
        raise exception 'You cannot admire yourself';
    end if;

    if not exists (
        select 1
        from public.profiles
        where id = target_user_id
    ) then
        raise exception 'Member not found';
    end if;

    insert into public.secret_admirers (
        admirer_id,
        admired_id
    )
    values (
        current_user_id,
        target_user_id
    )
    on conflict (admirer_id, admired_id)
    do update
        set created_at = public.secret_admirers.created_at
    returning *
    into admirer_row;

    return jsonb_build_object(
        'success', true,
        'secret_admirer_id', admirer_row.id,
        'already_sent',
        admirer_row.created_at < now() - interval '1 second'
    );
end;
$$;

revoke all on function public.send_secret_admirer(uuid)
    from public;

grant execute on function public.send_secret_admirer(uuid)
    to authenticated;

commit;
