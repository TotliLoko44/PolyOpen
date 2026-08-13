-- ==============================================================
-- PolyOpen Speed Dating
-- Mutual Continue -> existing public.matches bridge
--
-- User-facing terminology: Connections
-- Internal compatibility table: public.matches
-- ==============================================================

begin;

create or replace function public.ensure_speed_dating_connection(
    requested_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid := auth.uid();

    session_record
        public.speed_dating_sessions%rowtype;

    participant_one_decision text;
    participant_two_decision text;

    normalized_user_one uuid;
    normalized_user_two uuid;

    existing_match_id uuid;
    inserted_match_id uuid;
begin
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
        raise exception
            'Speed dating session not found';
    end if;

    select decision
      into participant_one_decision
      from public.speed_dating_decisions
     where session_id = requested_session_id
       and user_id =
           session_record.participant_one_id;

    select decision
      into participant_two_decision
      from public.speed_dating_decisions
     where session_id = requested_session_id
       and user_id =
           session_record.participant_two_id;

    if participant_one_decision <> 'continue'
       or participant_two_decision <> 'continue'
    then
        return jsonb_build_object(
            'status',
            'not-mutual',
            'matchId',
            null
        );
    end if;

    normalized_user_one :=
        least(
            session_record.participant_one_id,
            session_record.participant_two_id
        );

    normalized_user_two :=
        greatest(
            session_record.participant_one_id,
            session_record.participant_two_id
        );

    select id
      into existing_match_id
      from public.matches
     where least(user1_id, user2_id)
           = normalized_user_one
       and greatest(user1_id, user2_id)
           = normalized_user_two
     limit 1;

    if existing_match_id is not null then
        return jsonb_build_object(
            'status',
            'existing',
            'matchId',
            existing_match_id
        );
    end if;

    insert into public.matches (
        user1_id,
        user2_id,
        pair_key
    )
    values (
        normalized_user_one,
        normalized_user_two,
        normalized_user_one::text
            || ':'
            || normalized_user_two::text
    )
    on conflict do nothing
    returning id into inserted_match_id;

    if inserted_match_id is null then
        select id
          into inserted_match_id
          from public.matches
         where least(user1_id, user2_id)
               = normalized_user_one
           and greatest(user1_id, user2_id)
               = normalized_user_two
         limit 1;
    end if;

    return jsonb_build_object(
        'status',
        case
            when inserted_match_id is not null
                then 'ready'
            else 'failed'
        end,
        'matchId',
        inserted_match_id
    );
end;
$$;

revoke all
on function public.ensure_speed_dating_connection(uuid)
from public;

grant execute
on function public.ensure_speed_dating_connection(uuid)
to authenticated;


create or replace function
public.speed_dating_connection_bridge_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_user_one uuid;
    normalized_user_two uuid;
begin
    if new.status <> 'continued' then
        return new;
    end if;

    normalized_user_one :=
        least(
            new.participant_one_id,
            new.participant_two_id
        );

    normalized_user_two :=
        greatest(
            new.participant_one_id,
            new.participant_two_id
        );

    insert into public.matches (
        user1_id,
        user2_id,
        pair_key
    )
    values (
        normalized_user_one,
        normalized_user_two,
        normalized_user_one::text
            || ':'
            || normalized_user_two::text
    )
    on conflict do nothing;

    return new;
end;
$$;


drop trigger if exists
speed_dating_connection_bridge
on public.speed_dating_sessions;


create trigger
speed_dating_connection_bridge
after insert or update of status
on public.speed_dating_sessions
for each row
when (new.status = 'continued')
execute function
public.speed_dating_connection_bridge_trigger();


-- --------------------------------------------------------------
-- Backfill previously completed mutual-Continue Speed Dates.
-- --------------------------------------------------------------

insert into public.matches (
    user1_id,
    user2_id,
    pair_key
)
select
    least(
        session.participant_one_id,
        session.participant_two_id
    ),
    greatest(
        session.participant_one_id,
        session.participant_two_id
    ),
    least(
        session.participant_one_id,
        session.participant_two_id
    )::text
        || ':'
        || greatest(
            session.participant_one_id,
            session.participant_two_id
        )::text
from public.speed_dating_sessions session
where session.status = 'continued'
on conflict do nothing;

commit;
