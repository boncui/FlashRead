# FlashRead

A Next.js web application for creating, storing, and reading formatted text documents with automatic heading detection. Built with Next.js 15, TypeScript, Supabase, and Tailwind CSS.

## Monorepo Structure

This project is organized as a pnpm workspace monorepo with three packages:

- **frontend/** - Next.js 15 application (UI and pages)
- **backend/** - Shared services, server actions, Supabase clients, and types
- **agents/** - AI/LLM agents scaffold (for future development)

## Features

- 🔐 **Secure Authentication**: Email/password auth via Supabase
- 🔒 **Row Level Security**: Users can only access their own data
- 📝 **FlashRead Creation**: Paste text and automatically format with heading detection
- ✏️ **Edit & Delete**: Manage your FlashReads with full CRUD operations
- 🎨 **Modern UI**: Clean, responsive interface with Tailwind CSS and shadcn/ui
- 🚀 **Server Components**: Fast, efficient rendering with Next.js App Router

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Deployment Ready**: Vercel or Cloudflare Pages

## Prerequisites

- Node.js 20+ and pnpm (recommended) or npm
- A Supabase account (free tier works)

## Local Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd FlashRead
pnpm install
```

### 2. Set Up Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (takes ~2 minutes)
3. Go to **Settings** > **API** and copy:
   - Project URL
   - `anon` public key (NOT the service role key)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**IMPORTANT**: 
- Never commit `.env.local` to git
- Never use the service role key in this app
- Only use the `anon` (public) key - RLS policies protect your data

### 4. Run Database Migrations

Go to your Supabase project dashboard:

1. Navigate to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `backend/supabase/migrations/00001_initial_schema.sql`
4. Paste into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)

This will:
- Create `profiles` and `flashreads` tables
- Enable Row Level Security (RLS)
- Set up RLS policies
- Create a trigger to auto-create profiles on user signup

### 5. Configure Auth Settings (Optional)

For easier local testing, disable email confirmation:

1. Go to **Authentication** > **Providers** > **Email**
2. Scroll to **Confirm email**
3. Toggle it OFF
4. Click **Save**

**Note**: Re-enable this for production!

### 6. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Alternative commands:**
- `pnpm dev:frontend` - Run only the frontend
- `pnpm dev:agents` - Run the agents package
- `pnpm build` - Build all packages

## Project Structure

```
FlashRead/
├── package.json                   # Root workspace config
├── pnpm-workspace.yaml            # pnpm workspace definition
├── .env.local.example
├── .gitignore
├── README.md
│
├── frontend/                      # Next.js app
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── middleware.ts              # Auth middleware
│   └── src/
│       ├── app/
│       │   ├── layout.tsx         # Root layout
│       │   ├── page.tsx           # Home (redirects)
│       │   ├── login/
│       │   │   └── page.tsx       # Sign in / sign up
│       │   └── app/
│       │       ├── layout.tsx     # App layout with navbar
│       │       ├── page.tsx       # List all flashreads
│       │       ├── new/
│       │       │   └── page.tsx   # Create new flashread
│       │       └── [id]/
│       │           └── page.tsx   # View/edit/delete flashread
│       ├── components/
│       │   ├── ui/                # shadcn/ui components
│       │   ├── navbar.tsx
│       │   ├── flashread-card.tsx
│       │   ├── flashread-renderer.tsx
│       │   └── flashread-detail-client.tsx
│       └── lib/
│           └── utils.ts           # Client utilities
│
├── backend/                       # Shared services
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── actions/
│   │   │   ├── auth.ts            # Auth server actions
│   │   │   └── flashreads.ts      # CRUD server actions
│   │   └── lib/
│   │       ├── supabase/
│   │       │   ├── client.ts      # Browser Supabase client
│   │       │   ├── server.ts      # Server Supabase client
│   │       │   └── middleware.ts  # Middleware Supabase client
│   │       ├── types.ts           # TypeScript types
│   │       └── flashread-formatter.ts
│   └── supabase/
│       └── migrations/
│           └── 00001_initial_schema.sql
│
└── agents/                        # AI/LLM agents
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    └── src/
        └── index.ts               # Example agent
```

### Import Patterns

Frontend imports from backend using workspace references:

```typescript
// In frontend/src/**/*.tsx
import { getFlashreads } from '@flashread/backend/actions/flashreads';
import { Flashread } from '@flashread/backend/types';
import { createClient } from '@flashread/backend/supabase/server';
```

## Database Schema

### `profiles` Table

| Column      | Type   | Description                    |
|-------------|--------|--------------------------------|
| id          | uuid   | Primary key (refs auth.users)  |
| email       | text   | User email                     |
| created_at  | timestamptz | Profile creation timestamp |

### `flashreads` Table

| Column          | Type   | Description                        |
|-----------------|--------|------------------------------------|
| id              | uuid   | Primary key                        |
| user_id         | uuid   | Foreign key to profiles            |
| title           | text   | FlashRead title                    |
| source_text     | text   | Original text                      |
| render_config   | jsonb  | Rendering configuration (future)   |
| rendered_blocks | jsonb  | Array of formatted blocks          |
| created_at      | timestamptz | Creation timestamp            |
| updated_at      | timestamptz | Last update timestamp         |

### Row Level Security (RLS) Policies

**profiles:**
- Users can SELECT their own profile
- Users can UPDATE their own profile

**flashreads:**
- Users can SELECT their own flashreads
- Users can INSERT flashreads (user_id is set server-side)
- Users can UPDATE their own flashreads
- Users can DELETE their own flashreads

All policies enforce `auth.uid() = user_id` to ensure data isolation.

## How It Works

### Authentication Flow

1. User signs up or logs in via `/login`
2. Supabase Auth creates user in `auth.users` table
3. Database trigger auto-creates matching row in `profiles` table
4. Session token stored in HTTP-only cookie
5. Middleware refreshes session on every request to `/app/*`
6. Unauthenticated users are redirected to `/login`

### FlashRead Formatting

The `formatTextToBlocks()` function processes text:

1. **Split by blank lines** into paragraphs
2. **Detect headings** using heuristics:
   - ALL CAPS text (≥3 chars)
   - Lines ending with `:`
   - Common section names (Introduction, Methods, Results, etc.)
   - Title case short lines
   - Numbered headings (e.g., "1. Introduction")
3. **Output JSON**: `[{type: "heading" | "p", text: "..."}]`

Example:

```
Input:
INTRODUCTION

This is a paragraph.

Another paragraph.

Output:
[
  {type: "heading", text: "INTRODUCTION"},
  {type: "p", text: "This is a paragraph."},
  {type: "p", text: "Another paragraph."}
]
```

### Security Architecture

- **No service role key**: App uses only the anon key
- **Server-side user validation**: All mutations verify `auth.uid()` server-side
- **RLS as second layer**: Even if client tampers with requests, database policies block unauthorized access
- **Middleware auth check**: Protects all `/app/*` routes
- **HTTP-only cookies**: Session tokens not accessible to JavaScript

## Manual Test Checklist

Run through these tests to verify the app works correctly:

### ✅ Authentication Tests

- [ ] **Sign Up**
  1. Go to `/login`
  2. Click "Sign up"
  3. Enter email and password (min 6 chars)
  4. Submit form
  5. Should redirect to `/app`
  6. Check Supabase dashboard: new row in `auth.users` and `profiles`

- [ ] **Sign In**
  1. Sign out (click "Sign Out" in navbar)
  2. Go to `/login`
  3. Enter credentials
  4. Should redirect to `/app`

- [ ] **Auth Guard**
  1. Sign out
  2. Try to access `/app` directly
  3. Should redirect to `/login`

### ✅ CRUD Tests

- [ ] **Create FlashRead**
  1. Sign in
  2. Click "New FlashRead"
  3. Enter title (optional)
  4. Paste text with headings (use sample below)
  5. Click "Preview" - verify heading detection
  6. Click "Save FlashRead"
  7. Should redirect to detail page
  8. Check Supabase dashboard: new row in `flashreads` with correct `user_id`

- [ ] **Read FlashReads**
  1. Go to `/app`
  2. Should see your flashread in the list
  3. Click on it
  4. Should see formatted content with styled headings

- [ ] **Update FlashRead**
  1. On detail page, click "Edit Title"
  2. Change title
  3. Click "Save"
  4. Page should refresh with new title
  5. Check Supabase dashboard: `updated_at` changed

- [ ] **Delete FlashRead**
  1. On detail page, click "Delete FlashRead"
  2. Confirm deletion
  3. Should redirect to `/app`
  4. FlashRead should be gone from list
  5. Check Supabase dashboard: row deleted

### ✅ RLS Isolation Test

- [ ] **User A cannot access User B's data**
  1. Create flashread as User A
  2. Copy the flashread `id` from URL
  3. Sign out and create User B account
  4. Try to access User A's flashread: `/app/<user-a-flashread-id>`
  5. Should show "Not Found" or empty page
  6. In Supabase SQL Editor, run:
     ```sql
     SELECT * FROM flashreads WHERE id = '<user-a-flashread-id>';
     ```
     (As User B, this should return 0 rows due to RLS)

### ✅ Formatter Test

- [ ] **Heading Detection**
  1. Create new flashread with this sample text:
  ```
  INTRODUCTION
  
  This is the introduction paragraph.
  
  Methods and Results
  
  Here are the methods.
  
  CONCLUSION:
  
  Final thoughts.
  ```
  2. Click "Preview"
  3. Verify "INTRODUCTION", "Methods and Results", and "CONCLUSION:" are rendered as headings
  4. Verify other text is rendered as paragraphs

## Sample Test Data

Use this text to test heading detection:

```
ABSTRACT

This is an abstract paragraph with some content to test the FlashRead formatter.

Introduction

The introduction section explains the purpose. It has multiple sentences to make it realistic.

METHODOLOGY:

The methodology describes how we did the research. This is another paragraph.

Results and Discussion

Here we present the results. Multiple paragraphs can be included in each section.

CONCLUSION

The conclusion wraps up the document. This is the final section.
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Cloudflare Pages

1. Push code to GitHub
2. Create new Cloudflare Pages project
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
   - Framework preset: Next.js
4. Add environment variables
5. Deploy

**Important**: Re-enable email confirmation in Supabase for production!

## Troubleshooting

### "Invalid email or password"
- Check that you've created an account first
- Verify email confirmation is disabled (for local testing)
- Password must be at least 6 characters

### "Not authenticated" errors
- Verify `.env.local` has correct Supabase credentials
- Check that you're logged in
- Clear cookies and sign in again

### RLS policy errors
- Verify SQL migration ran successfully
- Check Supabase logs in dashboard
- Ensure RLS is enabled: `SELECT * FROM pg_tables WHERE schemaname = 'public';`

### Build errors
- Delete `.next` folder and `node_modules`
- Run `pnpm install` again
- Verify Node.js version is 20+
- For workspace issues, try `pnpm install --force`

## Contributing

This is an open-source MVP. Contributions welcome!

## License

MIT
