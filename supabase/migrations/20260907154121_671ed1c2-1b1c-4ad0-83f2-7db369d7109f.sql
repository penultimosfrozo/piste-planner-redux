CREATE TABLE public.itineraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  resort_slug TEXT NOT NULL,
  resort_name TEXT NOT NULL,
  resort_lat DOUBLE PRECISION NOT NULL,
  resort_lng DOUBLE PRECISION NOT NULL,
  hotel_provider TEXT NOT NULL,
  hotel_place_id TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  hotel_rating NUMERIC,
  hotel_address TEXT,
  rental_provider TEXT NOT NULL,
  rental_place_id TEXT NOT NULL,
  rental_name TEXT NOT NULL,
  rental_rating NUMERIC,
  rental_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itineraries TO authenticated;
GRANT ALL ON public.itineraries TO service_role;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own itineraries" ON public.itineraries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.resort_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '7 days',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.resort_cache TO authenticated;
GRANT ALL ON public.resort_cache TO service_role;
ALTER TABLE public.resort_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cache readable by signed-in users" ON public.resort_cache FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_itineraries_updated_at BEFORE UPDATE ON public.itineraries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();