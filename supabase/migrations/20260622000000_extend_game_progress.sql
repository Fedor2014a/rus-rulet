-- Расширяет сохранение игры. Применяется командой: npm run db:push
-- RLS уже включён в миграции 20260618000000_add_game_progress.sql.

alter table public.game_progress
  add column if not exists player_hp jsonb not null default '{"p1": 3, "p2": 3}'::jsonb,
  add column if not exists arrows jsonb not null default '{"p1": 8, "p2": 8}'::jsonb;

update public.game_progress
set
  player_hp = coalesce(player_hp, '{"p1": 3, "p2": 3}'::jsonb),
  arrows = coalesce(arrows, '{"p1": 8, "p2": 8}'::jsonb);

alter table public.game_progress
  add constraint game_progress_player_hp_shape
    check (
      jsonb_typeof(player_hp) = 'object'
      and (player_hp ? 'p1')
      and (player_hp ? 'p2')
    ),
  add constraint game_progress_arrows_shape
    check (
      jsonb_typeof(arrows) = 'object'
      and (arrows ? 'p1')
      and (arrows ? 'p2')
    );
