-- Migration to add personal_bonus_percentage to ranks table
ALTER TABLE public.ranks ADD COLUMN IF NOT EXISTS personal_bonus_percentage NUMERIC(5, 2) DEFAULT 0;

-- Optional: Initial data sync - if you want to set a default for existing ranks
-- UPDATE public.ranks SET personal_bonus_percentage = 15 WHERE personal_bonus_percentage = 0;
