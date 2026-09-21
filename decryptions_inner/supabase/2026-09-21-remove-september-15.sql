-- Retire the September 15 puzzle completely; it must not remain in the archive.
begin;

delete from private.attempts a
using private.puzzles p
where a.puzzle_id = p.id and p.publish_date = date '2026-09-15';

delete from public.progress g
using private.puzzles p
where g.puzzle_id = p.id::text and p.publish_date = date '2026-09-15';

delete from public.solves s
using private.puzzles p
where s.puzzle_id = p.id::text and p.publish_date = date '2026-09-15';

delete from private.puzzle_legacy_ids l
using private.puzzles p
where l.puzzle_id = p.id and p.publish_date = date '2026-09-15';

delete from private.puzzles where publish_date = date '2026-09-15';

notify pgrst, 'reload schema';
commit;
