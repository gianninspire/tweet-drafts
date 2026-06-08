# Content Studio

A personal content studio for drafting and managing Twitter/X tweets and threads.
Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

## Features

- **Tabbed composer** — switch between **Tweets** and **Threads**.
  - Tweets: a single textarea with a live 280-character counter.
  - Threads: a dynamic, numbered, multi-card composer. Press **Enter three times
    in a row** to start the next tweet. Each card has its own character counter.
- **Drafts** are split into **Tweet Drafts** and **Thread Drafts**, newest first.
  - **Copy** — copies to clipboard (threads use double line breaks between tweets).
  - **Edit** — loads the draft back into the composer; the old copy is removed on save.
  - **Delete** — removes the draft after a confirmation prompt.
- Clean, minimal dark UI.
- All database operations use the Supabase JS client directly from the browser.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   (See `.env.local.example`.)

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Supabase schema

The app expects a `drafts` table:

```sql
create table drafts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('tweet', 'thread')),
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'posted')),
  created_at timestamptz not null default now()
);
```

Because the app talks to Supabase from the browser with the anon key, enable Row
Level Security and add policies appropriate for your use (e.g. allow anon
read/insert/delete for a personal, single-user setup).

## Thread storage format

A thread is stored as a single `content` string with tweets joined by the
separator `---TWEET---`. The UI splits on this separator when displaying,
editing, and copying.

> Requires Node.js 18.18+ (Node 20+ recommended).
