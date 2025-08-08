-- Create public bucket for project logos
insert into storage.buckets (id, name, public)
values ('project-logos', 'project-logos', true)
on conflict (id) do nothing;

-- Storage policies for project-logos
create policy "Public read for project logos"
on storage.objects
for select
using (bucket_id = 'project-logos');

create policy "Authenticated upload project logos"
on storage.objects
for insert to authenticated
with check (bucket_id = 'project-logos');

create policy "Authenticated update project logos"
on storage.objects
for update to authenticated
using (bucket_id = 'project-logos');

create policy "Authenticated delete project logos"
on storage.objects
for delete to authenticated
using (bucket_id = 'project-logos');

-- Incident comments table
create table if not exists public.incident_comments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  user_id uuid not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.incident_comments enable row level security;

create policy "Anyone can view incident comments"
on public.incident_comments
for select
using (true);

create policy "Authenticated users can create comments"
on public.incident_comments
for insert to authenticated
with check (auth.uid() = user_id);

create index if not exists idx_incident_comments_incident on public.incident_comments(incident_id);