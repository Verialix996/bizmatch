-- PEER-01: nothing stopped the same author from submitting duplicate peer
-- feedback about the same founder, for the same dimension, in the same
-- activity — each duplicate fanned out into its own evidence row and
-- silently skewed the founder's weighted score. Scoped to activity_id IS
-- NOT NULL since that's the only way peer feedback is ever submitted today
-- (folded into the Activities flow) — a plain UNIQUE constraint wouldn't
-- catch this anyway, since NULLs never compare equal to each other.
create unique index peer_feedback_author_founder_activity_dim_uniq
  on public.peer_feedback (author_id, founder_id, activity_id, dimension)
  where activity_id is not null;
