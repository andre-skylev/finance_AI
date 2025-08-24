-- Add parent-child relationship to categories for subcategories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful index for parent lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Optional: ensure parent and child names can coexist; skip strict unique constraint to avoid breaking existing data
-- You may consider later: CREATE UNIQUE INDEX ... ON categories(user_id, lower(name), type, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));
