-- Enable RLS on all tables
ALTER TABLE public.contact_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- Lookup tables: read-only for anon
CREATE POLICY "Allow anon read on contact_sources" ON public.contact_sources FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on email_statuses" ON public.email_statuses FOR SELECT TO anon USING (true);

-- Data tables: full CRUD for anon (internal tool, no public users)
CREATE POLICY "Allow anon all on companies" ON public.companies FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on contacts" ON public.contacts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on email_drafts" ON public.email_drafts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on voice_logs" ON public.voice_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on action_items" ON public.action_items FOR ALL TO anon USING (true) WITH CHECK (true);
