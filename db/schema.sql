-- BeT Agency Co. — database schema (PostgreSQL 14+; works on Supabase, Neon, Vercel Postgres or any Postgres)
-- Run once: psql "$DATABASE_URL" -f db/schema.sql   (safe to re-run)

create extension if not exists pgcrypto;

-- Agency staff who can sign in to the dashboard
create table if not exists staff (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  role          text not null default 'staff' check (role in ('owner','staff')),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- One row per browser that accepted analytics cookies (anonymous id, no personal data)
create table if not exists visitors (
  id          text primary key,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  visits      int not null default 1
);

-- One row per visit
create table if not exists sessions (
  id            text primary key,
  visitor_id    text references visitors(id) on delete set null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  duration_s    int not null default 0,
  pageviews     int not null default 0,
  consent       boolean not null default false,
  country       text,
  region        text,
  city          text,
  referrer      text,
  source        text,
  medium        text,
  campaign      text,
  landing_path  text,
  device        text,
  browser       text,
  os            text,
  screen        text,
  language      text
);
create index if not exists sessions_started_idx on sessions (started_at desc);
create index if not exists sessions_visitor_idx on sessions (visitor_id);

-- Everything people do on the site: page views, cards flipped, enquiry steps, clicks
create table if not exists events (
  id          bigserial primary key,
  session_id  text references sessions(id) on delete cascade,
  type        text not null,
  name        text,
  path        text,
  data        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists events_created_idx on events (created_at desc);
create index if not exists events_type_idx on events (type, created_at desc);
create index if not exists events_session_idx on events (session_id);

-- Enquiries from the website form
create table if not exists enquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  slip        text,
  name        text not null,
  phone       text,
  email       text,
  brand       text,
  about       text,
  services    text[] not null default '{}',
  has_site    text,
  site        text,
  budget      text,
  timeline    text,
  status      text not null default 'new' check (status in ('new','contacted','in_talks','won','lost')),
  assigned_to uuid references staff(id) on delete set null,
  session_id  text references sessions(id) on delete set null,
  country     text,
  region      text,
  city        text,
  source      text,
  device      text
);
create index if not exists enquiries_created_idx on enquiries (created_at desc);
create index if not exists enquiries_status_idx on enquiries (status);

-- Internal notes the team leaves on an enquiry
create table if not exists enquiry_notes (
  id          bigserial primary key,
  enquiry_id  uuid not null references enquiries(id) on delete cascade,
  staff_id    uuid references staff(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists enquiry_notes_enquiry_idx on enquiry_notes (enquiry_id, created_at);

-- ---------- security additions (safe to re-run) ----------
-- Turning off a teammate's access keeps their history and can be undone
alter table staff add column if not exists disabled_at timestamptz;
-- One account per email, whatever the capitals
create unique index if not exists staff_email_lower_idx on staff (lower(email));

-- Signed-in sessions. The browser holds a random token; only a keyed hash is stored here.
create table if not exists staff_sessions (
  id           text primary key,
  staff_id     uuid not null references staff(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  user_agent   text
);
create index if not exists staff_sessions_staff_idx on staff_sessions (staff_id);

-- Failed sign-in attempts (hashed keys, no raw IPs or emails), used to slow down guessing
create table if not exists login_attempts (
  id         bigserial primary key,
  key        text not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_key_idx on login_attempts (key, created_at desc);

-- Stops two teammates silently overwriting each other's changes to an enquiry
alter table enquiries add column if not exists version int not null default 0;

-- On Supabase: block the public API from these tables. Both apps connect with the
-- database password on the server, never from the browser.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter table staff enable row level security';
    execute 'alter table visitors enable row level security';
    execute 'alter table sessions enable row level security';
    execute 'alter table events enable row level security';
    execute 'alter table enquiries enable row level security';
    execute 'alter table enquiry_notes enable row level security';
    execute 'alter table staff_sessions enable row level security';
    execute 'alter table login_attempts enable row level security';
    -- and make sure the public API roles can't touch anything here at all
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
  end if;
end $$;
