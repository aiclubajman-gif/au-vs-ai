-- ============================================================================
-- AU vs AI — 0011 Round 1 Dataset Index
-- Ensures each image storage_path is unique in round1_images
-- ============================================================================

create unique index if not exists round1_images_storage_path_idx
  on public.round1_images(storage_path);
