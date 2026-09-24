begin;

create table if not exists public.vip_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.vip_memberships (
    user_id uuid primary key references auth.users(id) on delete cascade,
    granted_by uuid not null references auth.users(id),
    note text not null default '',
    is_active boolean not null default true,
    granted_at timestamptz not null default now(),
    revoked_at timestamptz,
    revoked_by uuid references auth.users(id),
    updated_at timestamptz not null default now(),
    constraint vip_note_length check (char_length(note) <= 1000),
    constraint vip_revocation_state check (
        (is_active = true and revoked_at is null and revoked_by is null)
        or
        (is_active = false and revoked_at is not null and revoked_by is not null)
    )
);

create table if not exists public.vip_audit_log (
    id bigint generated always as identity primary key,
    member_user_id uuid not null references auth.users(id) on delete cascade,
    performed_by uuid not null references auth.users(id),
    action text not null check (action in ('granted', 'updated', 'revoked')),
    note text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists vip_memberships_active_idx
    on public.vip_memberships (is_active, granted_at desc);

create index if not exists vip_audit_log_member_idx
    on public.vip_audit_log (member_user_id, created_at desc);

alter table public.vip_admins enable row level security;
alter table public.vip_memberships enable row level security;
alter table public.vip_audit_log enable row level security;

create or replace function public.is_vip_admin(
    target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.vip_admins
        where user_id = target_user_id
    );
$$;

create or replace function public.has_vip_access(
    target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.vip_memberships
        where user_id = target_user_id
          and is_active = true
    );
$$;

revoke all on function public.is_vip_admin(uuid) from public;
revoke all on function public.has_vip_access(uuid) from public;

grant execute on function public.is_vip_admin(uuid) to authenticated;
grant execute on function public.has_vip_access(uuid) to authenticated;

drop policy if exists "VIP admins can read administrators"
    on public.vip_admins;

create policy "VIP admins can read administrators"
on public.vip_admins
for select
to authenticated
using (public.is_vip_admin(auth.uid()));

drop policy if exists "Members can read own VIP status"
    on public.vip_memberships;

create policy "Members can read own VIP status"
on public.vip_memberships
for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_vip_admin(auth.uid())
);

drop policy if exists "VIP admins can read audit history"
    on public.vip_audit_log;

create policy "VIP admins can read audit history"
on public.vip_audit_log
for select
to authenticated
using (public.is_vip_admin(auth.uid()));

create or replace function public.admin_grant_vip(
    target_user_id uuid,
    membership_note text default ''
)
returns public.vip_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
    result public.vip_memberships;
    audit_action text;
begin
    if not public.is_vip_admin(auth.uid()) then
        raise exception 'VIP administrator access required';
    end if;

    if target_user_id is null then
        raise exception 'VIP member user ID is required';
    end if;

    if char_length(coalesce(membership_note, '')) > 1000 then
        raise exception 'VIP note cannot exceed 1000 characters';
    end if;

    audit_action :=
        case
            when exists (
                select 1
                from public.vip_memberships
                where user_id = target_user_id
            )
            then 'updated'
            else 'granted'
        end;

    insert into public.vip_memberships (
        user_id,
        granted_by,
        note,
        is_active,
        granted_at,
        revoked_at,
        revoked_by,
        updated_at
    )
    values (
        target_user_id,
        auth.uid(),
        coalesce(membership_note, ''),
        true,
        now(),
        null,
        null,
        now()
    )
    on conflict (user_id) do update
    set
        granted_by = excluded.granted_by,
        note = excluded.note,
        is_active = true,
        granted_at = now(),
        revoked_at = null,
        revoked_by = null,
        updated_at = now()
    returning * into result;

    insert into public.vip_audit_log (
        member_user_id,
        performed_by,
        action,
        note
    )
    values (
        target_user_id,
        auth.uid(),
        audit_action,
        coalesce(membership_note, '')
    );

    return result;
end;
$$;

create or replace function public.admin_revoke_vip(
    target_user_id uuid,
    revocation_note text default ''
)
returns public.vip_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
    result public.vip_memberships;
begin
    if not public.is_vip_admin(auth.uid()) then
        raise exception 'VIP administrator access required';
    end if;

    if target_user_id is null then
        raise exception 'VIP member user ID is required';
    end if;

    if char_length(coalesce(revocation_note, '')) > 1000 then
        raise exception 'VIP note cannot exceed 1000 characters';
    end if;

    update public.vip_memberships
    set
        is_active = false,
        note = case
            when coalesce(revocation_note, '') = '' then note
            else revocation_note
        end,
        revoked_at = now(),
        revoked_by = auth.uid(),
        updated_at = now()
    where user_id = target_user_id
    returning * into result;

    if result.user_id is null then
        raise exception 'VIP membership was not found';
    end if;

    insert into public.vip_audit_log (
        member_user_id,
        performed_by,
        action,
        note
    )
    values (
        target_user_id,
        auth.uid(),
        'revoked',
        coalesce(revocation_note, '')
    );

    return result;
end;
$$;

revoke all on function public.admin_grant_vip(uuid, text) from public;
revoke all on function public.admin_revoke_vip(uuid, text) from public;

grant execute on function public.admin_grant_vip(uuid, text) to authenticated;
grant execute on function public.admin_revoke_vip(uuid, text) to authenticated;

insert into public.vip_admins (user_id)
values ('467eb32a-8dba-4637-9336-8777aca4b43d'::uuid)
on conflict (user_id) do nothing;

comment on table public.vip_memberships is
    'Server-authorized complimentary VIP access. VIP grants all paid PolyOpen features.';

comment on column public.vip_memberships.note is
    'Owner-entered explanation of where the member came from or why VIP was granted.';

comment on function public.has_vip_access(uuid) is
    'Returns active VIP status without exposing the VIP membership directory.';

commit;
