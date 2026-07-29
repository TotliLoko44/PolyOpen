begin;

create extension if not exists pgcrypto;

create table if not exists public.speed_dating_queue (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    scope text not null check (length(trim(scope)) between 1 and 80),
    status text not null default 'waiting'
        check (status in ('waiting', 'matched', 'cancelled', 'expired')),
    matched_session_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '5 minutes'),
    unique (user_id)
);

create table if not exists public.speed_dating_sessions (
    id uuid primary key default gen_random_uuid(),
    participant_one_id uuid not null references auth.users(id) on delete cascade,
    participant_two_id uuid not null references auth.users(id) on delete cascade,
    scope text not null check (length(trim(scope)) between 1 and 80),
    status text not null default 'matched'
        check (
            status in (
                'matched',
                'connecting',
                'active',
                'decision',
                'continued',
                'passed',
                'ended',
                'cancelled'
            )
        ),
    livekit_room_name text,
    started_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (participant_one_id <> participant_two_id)
);

alter table public.speed_dating_queue
    drop constraint if exists speed_dating_queue_matched_session_id_fkey;

alter table public.speed_dating_queue
    add constraint speed_dating_queue_matched_session_id_fkey
    foreign key (matched_session_id)
    references public.speed_dating_sessions(id)
    on delete set null;

create table if not exists public.speed_dating_decisions (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null
        references public.speed_dating_sessions(id)
        on delete cascade,
    user_id uuid not null
        references auth.users(id)
        on delete cascade,
    decision text not null
        check (decision in ('continue', 'pass')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (session_id, user_id)
);

create table if not exists public.speed_dating_chat_unlocks (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null unique
        references public.speed_dating_sessions(id)
        on delete cascade,
    participant_one_id uuid not null
        references auth.users(id)
        on delete cascade,
    participant_two_id uuid not null
        references auth.users(id)
        on delete cascade,
    unlocked_at timestamptz not null default now(),
    check (participant_one_id <> participant_two_id)
);

create index if not exists speed_dating_queue_waiting_lookup_idx
    on public.speed_dating_queue (
        scope,
        status,
        created_at
    );

create index if not exists speed_dating_queue_expiration_idx
    on public.speed_dating_queue (
        status,
        expires_at
    );

create index if not exists speed_dating_sessions_participant_one_idx
    on public.speed_dating_sessions (
        participant_one_id,
        created_at desc
    );

create index if not exists speed_dating_sessions_participant_two_idx
    on public.speed_dating_sessions (
        participant_two_id,
        created_at desc
    );

create index if not exists speed_dating_decisions_session_idx
    on public.speed_dating_decisions (
        session_id
    );

create or replace function public.set_speed_dating_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists speed_dating_queue_updated_at
    on public.speed_dating_queue;

create trigger speed_dating_queue_updated_at
before update on public.speed_dating_queue
for each row
execute function public.set_speed_dating_updated_at();

drop trigger if exists speed_dating_sessions_updated_at
    on public.speed_dating_sessions;

create trigger speed_dating_sessions_updated_at
before update on public.speed_dating_sessions
for each row
execute function public.set_speed_dating_updated_at();

drop trigger if exists speed_dating_decisions_updated_at
    on public.speed_dating_decisions;

create trigger speed_dating_decisions_updated_at
before update on public.speed_dating_decisions
for each row
execute function public.set_speed_dating_updated_at();

alter table public.speed_dating_queue enable row level security;
alter table public.speed_dating_sessions enable row level security;
alter table public.speed_dating_decisions enable row level security;
alter table public.speed_dating_chat_unlocks enable row level security;

drop policy if exists speed_dating_queue_select_own
    on public.speed_dating_queue;

create policy speed_dating_queue_select_own
on public.speed_dating_queue
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists speed_dating_queue_insert_own
    on public.speed_dating_queue;

create policy speed_dating_queue_insert_own
on public.speed_dating_queue
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists speed_dating_queue_update_own
    on public.speed_dating_queue;

create policy speed_dating_queue_update_own
on public.speed_dating_queue
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists speed_dating_queue_delete_own
    on public.speed_dating_queue;

create policy speed_dating_queue_delete_own
on public.speed_dating_queue
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists speed_dating_sessions_select_participant
    on public.speed_dating_sessions;

create policy speed_dating_sessions_select_participant
on public.speed_dating_sessions
for select
to authenticated
using (
    auth.uid() = participant_one_id
    or auth.uid() = participant_two_id
);

drop policy if exists speed_dating_decisions_select_session_participant
    on public.speed_dating_decisions;

create policy speed_dating_decisions_select_session_participant
on public.speed_dating_decisions
for select
to authenticated
using (
    exists (
        select 1
        from public.speed_dating_sessions session_record
        where session_record.id = speed_dating_decisions.session_id
          and (
              session_record.participant_one_id = auth.uid()
              or session_record.participant_two_id = auth.uid()
          )
    )
);

drop policy if exists speed_dating_decisions_insert_own
    on public.speed_dating_decisions;

create policy speed_dating_decisions_insert_own
on public.speed_dating_decisions
for insert
to authenticated
with check (
    user_id = auth.uid()
    and exists (
        select 1
        from public.speed_dating_sessions session_record
        where session_record.id = speed_dating_decisions.session_id
          and (
              session_record.participant_one_id = auth.uid()
              or session_record.participant_two_id = auth.uid()
          )
    )
);

drop policy if exists speed_dating_decisions_update_own
    on public.speed_dating_decisions;

create policy speed_dating_decisions_update_own
on public.speed_dating_decisions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists speed_dating_chat_unlocks_select_participant
    on public.speed_dating_chat_unlocks;

create policy speed_dating_chat_unlocks_select_participant
on public.speed_dating_chat_unlocks
for select
to authenticated
using (
    participant_one_id = auth.uid()
    or participant_two_id = auth.uid()
);

create or replace function public.join_speed_dating_queue(
    requested_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    normalized_scope text;
    candidate_record public.speed_dating_queue%rowtype;
    created_session public.speed_dating_sessions%rowtype;
begin
    current_user_id := auth.uid();
    normalized_scope := trim(requested_scope);

    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    if normalized_scope is null
       or length(normalized_scope) < 1
       or length(normalized_scope) > 80 then
        raise exception 'Invalid speed dating scope';
    end if;

    update public.speed_dating_queue
    set
        status = 'expired',
        updated_at = now()
    where status = 'waiting'
      and expires_at <= now();

    update public.speed_dating_queue
    set
        status = 'cancelled',
        updated_at = now()
    where user_id = current_user_id
      and status = 'waiting';

    select queue_record.*
    into candidate_record
    from public.speed_dating_queue queue_record
    where queue_record.user_id <> current_user_id
      and queue_record.scope = normalized_scope
      and queue_record.status = 'waiting'
      and queue_record.expires_at > now()
    order by queue_record.created_at asc
    for update skip locked
    limit 1;

    if candidate_record.id is null then
        insert into public.speed_dating_queue (
            user_id,
            scope,
            status,
            matched_session_id,
            expires_at
        )
        values (
            current_user_id,
            normalized_scope,
            'waiting',
            null,
            now() + interval '5 minutes'
        )
        on conflict (user_id)
        do update set
            scope = excluded.scope,
            status = 'waiting',
            matched_session_id = null,
            expires_at = excluded.expires_at,
            updated_at = now();

        return jsonb_build_object(
            'status', 'waiting',
            'scope', normalized_scope,
            'userId', current_user_id
        );
    end if;

    insert into public.speed_dating_sessions (
        participant_one_id,
        participant_two_id,
        scope,
        status,
        livekit_room_name
    )
    values (
        candidate_record.user_id,
        current_user_id,
        normalized_scope,
        'matched',
        'polyopen-speed-date-' || replace(gen_random_uuid()::text, '-', '')
    )
    returning *
    into created_session;

    update public.speed_dating_queue
    set
        status = 'matched',
        matched_session_id = created_session.id,
        updated_at = now()
    where user_id in (
        candidate_record.user_id,
        current_user_id
    );

    return jsonb_build_object(
        'status', 'matched',
        'sessionId', created_session.id,
        'partnerId', candidate_record.user_id,
        'scope', created_session.scope,
        'livekitRoomName', created_session.livekit_room_name
    );
end;
$$;

create or replace function public.get_speed_dating_match()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    queue_record public.speed_dating_queue%rowtype;
    session_record public.speed_dating_sessions%rowtype;
    partner_id uuid;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    select *
    into queue_record
    from public.speed_dating_queue
    where user_id = current_user_id
    limit 1;

    if queue_record.id is null then
        return jsonb_build_object(
            'status', 'idle'
        );
    end if;

    if queue_record.status = 'waiting'
       and queue_record.expires_at <= now() then
        update public.speed_dating_queue
        set
            status = 'expired',
            updated_at = now()
        where id = queue_record.id;

        return jsonb_build_object(
            'status', 'expired'
        );
    end if;

    if queue_record.status <> 'matched'
       or queue_record.matched_session_id is null then
        return jsonb_build_object(
            'status', queue_record.status,
            'scope', queue_record.scope
        );
    end if;

    select *
    into session_record
    from public.speed_dating_sessions
    where id = queue_record.matched_session_id
      and (
          participant_one_id = current_user_id
          or participant_two_id = current_user_id
      )
    limit 1;

    if session_record.id is null then
        return jsonb_build_object(
            'status', 'idle'
        );
    end if;

    partner_id := case
        when session_record.participant_one_id = current_user_id
            then session_record.participant_two_id
        else session_record.participant_one_id
    end;

    return jsonb_build_object(
        'status', 'matched',
        'sessionId', session_record.id,
        'partnerId', partner_id,
        'scope', session_record.scope,
        'sessionStatus', session_record.status,
        'livekitRoomName', session_record.livekit_room_name
    );
end;
$$;

create or replace function public.cancel_speed_dating_queue()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    affected_rows integer;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    update public.speed_dating_queue
    set
        status = 'cancelled',
        updated_at = now()
    where user_id = current_user_id
      and status = 'waiting';

    get diagnostics affected_rows = row_count;

    return jsonb_build_object(
        'status', 'cancelled',
        'updated', affected_rows > 0
    );
end;
$$;

create or replace function public.submit_speed_dating_decision(
    requested_session_id uuid,
    requested_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    session_record public.speed_dating_sessions%rowtype;
    partner_id uuid;
    current_decision text;
    partner_decision text;
    chat_unlocked boolean := false;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    if requested_decision not in ('continue', 'pass') then
        raise exception 'Decision must be continue or pass';
    end if;

    select *
    into session_record
    from public.speed_dating_sessions
    where id = requested_session_id
      and (
          participant_one_id = current_user_id
          or participant_two_id = current_user_id
      )
    for update;

    if session_record.id is null then
        raise exception 'Speed dating session not found';
    end if;

    partner_id := case
        when session_record.participant_one_id = current_user_id
            then session_record.participant_two_id
        else session_record.participant_one_id
    end;

    insert into public.speed_dating_decisions (
        session_id,
        user_id,
        decision
    )
    values (
        requested_session_id,
        current_user_id,
        requested_decision
    )
    on conflict (session_id, user_id)
    do update set
        decision = excluded.decision,
        updated_at = now();

    select decision
    into current_decision
    from public.speed_dating_decisions
    where session_id = requested_session_id
      and user_id = current_user_id;

    select decision
    into partner_decision
    from public.speed_dating_decisions
    where session_id = requested_session_id
      and user_id = partner_id;

    if current_decision = 'continue'
       and partner_decision = 'continue' then
        insert into public.speed_dating_chat_unlocks (
            session_id,
            participant_one_id,
            participant_two_id
        )
        values (
            requested_session_id,
            session_record.participant_one_id,
            session_record.participant_two_id
        )
        on conflict (session_id)
        do nothing;

        update public.speed_dating_sessions
        set
            status = 'continued',
            updated_at = now()
        where id = requested_session_id;

        chat_unlocked := true;
    elsif current_decision = 'pass'
       or partner_decision = 'pass' then
        update public.speed_dating_sessions
        set
            status = 'passed',
            updated_at = now()
        where id = requested_session_id;
    else
        update public.speed_dating_sessions
        set
            status = 'decision',
            updated_at = now()
        where id = requested_session_id;
    end if;

    return jsonb_build_object(
        'status',
        case
            when chat_unlocked then 'mutual-continue'
            when partner_decision is null then 'waiting-for-partner'
            when current_decision = 'pass'
                 or partner_decision = 'pass'
                then 'passed'
            else 'decision-recorded'
        end,
        'sessionId', requested_session_id,
        'yourDecision', current_decision,
        'partnerDecision', partner_decision,
        'chatUnlocked', chat_unlocked
    );
end;
$$;

create or replace function public.start_speed_dating_session(
    requested_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    updated_session public.speed_dating_sessions%rowtype;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    update public.speed_dating_sessions
    set
        status = 'active',
        started_at = coalesce(started_at, now()),
        ends_at = coalesce(ends_at, now() + interval '2 minutes'),
        updated_at = now()
    where id = requested_session_id
      and (
          participant_one_id = current_user_id
          or participant_two_id = current_user_id
      )
      and status in ('matched', 'connecting', 'active')
    returning *
    into updated_session;

    if updated_session.id is null then
        raise exception 'Speed dating session could not be started';
    end if;

    return jsonb_build_object(
        'status', updated_session.status,
        'sessionId', updated_session.id,
        'startedAt', updated_session.started_at,
        'endsAt', updated_session.ends_at,
        'livekitRoomName', updated_session.livekit_room_name
    );
end;
$$;

revoke all on function public.join_speed_dating_queue(text)
    from public;

revoke all on function public.get_speed_dating_match()
    from public;

revoke all on function public.cancel_speed_dating_queue()
    from public;

revoke all on function public.submit_speed_dating_decision(uuid, text)
    from public;

revoke all on function public.start_speed_dating_session(uuid)
    from public;

grant execute on function public.join_speed_dating_queue(text)
    to authenticated;

grant execute on function public.get_speed_dating_match()
    to authenticated;

grant execute on function public.cancel_speed_dating_queue()
    to authenticated;

grant execute on function public.submit_speed_dating_decision(uuid, text)
    to authenticated;

grant execute on function public.start_speed_dating_session(uuid)
    to authenticated;

do $$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) then
        begin
            alter publication supabase_realtime
                add table public.speed_dating_queue;
        exception
            when duplicate_object then
                null;
        end;

        begin
            alter publication supabase_realtime
                add table public.speed_dating_sessions;
        exception
            when duplicate_object then
                null;
        end;

        begin
            alter publication supabase_realtime
                add table public.speed_dating_decisions;
        exception
            when duplicate_object then
                null;
        end;

        begin
            alter publication supabase_realtime
                add table public.speed_dating_chat_unlocks;
        exception
            when duplicate_object then
                null;
        end;
    end if;
end;
$$;

commit;
