# Documentation: Supabase Reports Feature

## Overview
This feature allows users to submit reports from the `/report` page. It categorizes reports (e.g., Bug, Abus, Problème de paiement, Autre) and optionally includes an uploaded image.

## Supabase Requirements
To fully enable this feature in Production, the following Supabase configuration is required:

### 1. Database Table
Create a table named `reports`.
```sql
CREATE TABLE public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  category text NOT NULL,
  description text NOT NULL,
  image_url text
);

-- Active RLS (Row Level Security)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own reports
CREATE POLICY "Users can insert their own reports" 
ON public.reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
```

### 2. Storage Bucket
Create a storage bucket named `reports` (public or private depending on how you want admins to view it).
```sql
insert into storage.buckets (id, name)
values ('reports', 'reports');

-- Allow authenticated users to upload to reports bucket
create policy "Authenticated users can upload reports images"
on storage.objects for insert to authenticated with check (
    bucket_id = 'reports'
);
```
