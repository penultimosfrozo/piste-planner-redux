ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS efficiency_score numeric,
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb;