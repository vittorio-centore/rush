alter table public.events
  drop constraint if exists events_event_type_check,
  add constraint events_event_type_check
    check (
      event_type in (
        'view',
        'click',
        'follow',
        'unfollow',
        'apply_add',
        'apply',
        'native_apply',
        'search',
        'filter',
        'recommendation_impression'
      )
    );
