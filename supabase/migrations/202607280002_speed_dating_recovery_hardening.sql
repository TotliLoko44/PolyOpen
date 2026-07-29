begin;

alter table public.speed_dating_sessions
    add column if not exists participant_one_last_seen_at timestamptz;

alter table public.speed_dating_sessions
    add column if not exists participant_two_last_seen_at timestamptz;

alter table public.speed_dating_sessions
    add column if not exists ended_reason text;

create index if not exists speed_dating_sessions_status_ends_at_idx
    on public.speed_dating_sessions (
        status,
        ends_at
    );

create index if not exists speed_dating_sessions_recovery_one_idx
    on public.speed_dating_sessions (
        participant_one_id,
        status,
        updated_at desc
    );

create index if not exists speed_dating_sessions_recovery_two_idx
    on public.speed_dating_sessions (
        participant_two_id,
        status,
        updated_at desc
    );

create or replace function public.cleanup_speed_dating_state()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    expired_queue_count integer := 0;
    expired_active_count integer := 0;
    cancelled_orphan_count integer := 0;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    update public.speed_dating_queue
    set
        status = 'expired',
        updated_at = now()
    where status = 'waiting'
      and expires_at <= now();

    get diagnostics expired_queue_count = row_count;

    update public.speed_dating_sessions
    set
        status = 'decision',
        ended_reason = coalesce(
            ended_reason,
            'timer-expired'
        ),
        updated_at = now()
    where status = 'active'
      and ends_at is not null
      and ends_at <= now();

    get diagnostics expired_active_count = row_count;

    update public.speed_dating_sessions
    set
        status = 'cancelled',
        ended_reason = coalesce(
            ended_reason,
            'connection-timeout'
        ),
        updated_at = now()
    where status in (
        'matched',
        'connecting'
    )
      and created_at <= now() - interval '3 minutes'
      and started_at is null;

    get diagnostics cancelled_orphan_count = row_count;

    update public.speed_dating_queue queue_record
    set
        status = 'cancelled',
        updated_at = now()
    where queue_record.status = 'matched'
      and queue_record.matched_session_id is not null
      and exists (
          select 1
          from public.speed_dating_sessions session_record
          where session_record.id =
              queue_record.matched_session_id
            and session_record.status = 'cancelled'
      );

    return jsonb_build_object(
        'status', 'cleaned',
        'expiredQueueCount', expired_queue_count,
        'expiredActiveCount', expired_active_count,
        'cancelledOrphanCount', cancelled_orphan_count
    );
end;
$$;

create or replace function public.heartbeat_speed_dating_session(
    requested_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    session_record public.speed_dating_sessions%rowtype;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception 'Authentication required';
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

    if session_record.status = 'active'
       and session_record.ends_at is not null
       and session_record.ends_at <= now() then

        update public.speed_dating_sessions
        set
            status = 'decision',
            ended_reason = coalesce(
                ended_reason,
                'timer-expired'
            ),
            updated_at = now()
        where id = requested_session_id;

        session_record.status := 'decision';
        session_record.updated_at := now();
    end if;

    if session_record.participant_one_id =
       current_user_id then

        update public.speed_dating_sessions
        set
            participant_one_last_seen_at = now(),
            updated_at = now()
        where id = requested_session_id;
    else
        update public.speed_dating_sessions
        set
            participant_two_last_seen_at = now(),
            updated_at = now()
        where id = requested_session_id;
    end if;

    return jsonb_build_object(
        'status', session_record.status,
        'sessionId', session_record.id,
        'endsAt', session_record.ends_at,
        'serverTime', now()
    );
end;
$$;

create or replace function public.recover_speed_dating_session()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    session_record public.speed_dating_sessions%rowtype;
    partner_id uuid;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception 'Authentication required';
    end if;

    perform public.cleanup_speed_dating_state();

    select *
    into session_record
    from public.speed_dating_sessions
    where (
        participant_one_id = current_user_id
        or participant_two_id = current_user_id
    )
      and status in (
          'matched',
          'connecting',
          'active',
          'decision',
          'continued'
      )
    order by updated_at desc
    limit 1;

    if session_record.id is null then
        return jsonb_build_object(
            'status', 'idle'
        );
    end if;

    partner_id := case
        when session_record.participant_one_id =
             current_user_id
            then session_record.participant_two_id
        else session_record.participant_one_id
    end;

    return jsonb_build_object(
        'status', 'recovered',
        'sessionId', session_record.id,
        'sessionStatus', session_record.status,
        'partnerId', partner_id,
        'scope', session_record.scope,
        'startedAt', session_record.started_at,
        'endsAt', session_record.ends_at,
        'livekitRoomName',
            session_record.livekit_room_name
    );
end;
$$;

create or replace function public.leave_speed_dating_session(
    requested_session_id uuid,
    requested_reason text default 'user-left'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid;
    session_record public.speed_dating_sessions%rowtype;
    normalized_reason text;
begin
    current_user_id := auth.uid();
    normalized_reason := left(
        coalesce(
            nullif(
                trim(requested_reason),
                ''
            ),
            'user-left'
        ),
        80
    );

    if current_user_id is null then
        raise exception 'Authentication required';
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

    if session_record.status not in (
        'continued',
        'passed',
        'ended',
        'cancelled'
    ) then
        update public.speed_dating_sessions
        set
            status = 'cancelled',
            ended_reason = normalized_reason,
            updated_at = now()
        where id = requested_session_id;

        update public.speed_dating_queue
        set
            status = 'cancelled',
            updated_at = now()
        where matched_session_id =
            requested_session_id;
    end if;

    return jsonb_build_object(
        'status',
        case
            when session_record.status in (
                'continued',
                'passed',
                'ended',
                'cancelled'
            )
                then session_record.status
            else 'cancelled'
        end,
        'sessionId', requested_session_id,
        'reason', normalized_reason
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
        status = case
            when status in (
                'matched',
                'connecting'
            )
                then 'active'
            else status
        end,
        started_at = coalesce(
            started_at,
            now()
        ),
        ends_at = coalesce(
            ends_at,
            now() + interval '2 minutes'
        ),
        participant_one_last_seen_at = case
            when participant_one_id =
                 current_user_id
                then now()
            else participant_one_last_seen_at
        end,
        participant_two_last_seen_at = case
            when participant_two_id =
                 current_user_id
                then now()
            else participant_two_last_seen_at
        end,
        updated_at = now()
    where id = requested_session_id
      and (
          participant_one_id = current_user_id
          or participant_two_id = current_user_id
      )
      and status in (
          'matched',
          'connecting',
          'active'
      )
    returning *
    into updated_session;

    if updated_session.id is null then
        select *
        into updated_session
        from public.speed_dating_sessions
        where id = requested_session_id
          and (
              participant_one_id = current_user_id
              or participant_two_id =
                 current_user_id
          )
          and status in (
              'decision',
              'continued',
              'passed'
          )
        limit 1;
    end if;

    if updated_session.id is null then
        raise exception
            'Speed dating session could not be started';
    end if;

    return jsonb_build_object(
        'status', updated_session.status,
        'sessionId', updated_session.id,
        'startedAt', updated_session.started_at,
        'endsAt', updated_session.ends_at,
        'livekitRoomName',
            updated_session.livekit_room_name
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

    if requested_decision not in (
        'continue',
        'pass'
    ) then
        raise exception
            'Decision must be continue or pass';
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
        raise exception
            'Speed dating session not found';
    end if;

    if session_record.status in (
        'cancelled',
        'ended'
    ) then
        raise exception
            'This Speed Date is no longer active';
    end if;

    partner_id := case
        when session_record.participant_one_id =
             current_user_id
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
    on conflict (
        session_id,
        user_id
    )
    do update set
        decision = case
            when public.speed_dating_decisions.decision =
                 'pass'
                then 'pass'
            else excluded.decision
        end,
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
            ended_reason = 'mutual-continue',
            updated_at = now()
        where id = requested_session_id;

        chat_unlocked := true;

    elsif current_decision = 'pass'
       or partner_decision = 'pass' then

        update public.speed_dating_sessions
        set
            status = 'passed',
            ended_reason = 'participant-passed',
            updated_at = now()
        where id = requested_session_id;

    else
        update public.speed_dating_sessions
        set
            status = 'decision',
            ended_reason = coalesce(
                ended_reason,
                'awaiting-decisions'
            ),
            updated_at = now()
        where id = requested_session_id;
    end if;

    return jsonb_build_object(
        'status',
        case
            when chat_unlocked
                then 'mutual-continue'
            when current_decision = 'pass'
                 or partner_decision = 'pass'
                then 'passed'
            when partner_decision is null
                then 'waiting-for-partner'
            else 'decision-recorded'
        end,
        'sessionId', requested_session_id,
        'yourDecision', current_decision,
        'partnerDecision', partner_decision,
        'chatUnlocked', chat_unlocked
    );
end;
$$;

revoke all on function
    public.cleanup_speed_dating_state()
    from public;

revoke all on function
    public.heartbeat_speed_dating_session(uuid)
    from public;

revoke all on function
    public.recover_speed_dating_session()
    from public;

revoke all on function
    public.leave_speed_dating_session(uuid, text)
    from public;

grant execute on function
    public.cleanup_speed_dating_state()
    to authenticated;

grant execute on function
    public.heartbeat_speed_dating_session(uuid)
    to authenticated;

grant execute on function
    public.recover_speed_dating_session()
    to authenticated;

grant execute on function
    public.leave_speed_dating_session(uuid, text)
    to authenticated;

commit;
