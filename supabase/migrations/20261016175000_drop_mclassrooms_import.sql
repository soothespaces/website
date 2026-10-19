-- The MClassrooms import left an empty staging table on production
-- (private.mclassrooms_import). The rows now come from scripts/seed/, so it
-- isn't needed. It never existed outside production, hence "if exists".

drop table if exists private.mclassrooms_import;
