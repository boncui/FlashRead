# 🔧 Fix: Apply Missing Database Migrations

## The Problem
PDF upload may fail with one of these errors:
```
column documents.content_hash does not exist
```
or
```
duplicate key value violates unique constraint "documents_storage_key_key"
```

## The Solution
Apply the database migrations that add missing columns and fix constraints.

---

## ⚡ Quick Fix (2 minutes)

### Step 1: Open Supabase SQL Editor
Click this link:
**[Open SQL Editor](https://supabase.com/dashboard/project/iqspeaeuxpeijyncoiua/sql/new)**

### Step 2: Copy & Paste the SQL
Copy the **entire contents** of the file `APPLY_THIS.sql` (in this same folder)

### Step 3: Run
Click the **"Run"** button in the SQL Editor

### Step 4: Verify
Look for a success message. If you see any errors about "already exists", that's OK - it means those parts were already applied.

---

## 📋 What Gets Applied

These migrations add support for document processing:

### Migration 00004 - OCR Schema
- ✅ `content_hash` column - for detecting duplicate uploads
- ✅ `ocr_versions` column - for storing multiple OCR results
- ✅ `derived_content` column - for processed content
- ✅ Index on `content_hash` - for fast lookups

### Migration 00005 - Job Queue
- ✅ `document_jobs` table - async processing queue
- ✅ Indexes for efficient job management
- ✅ Support for extraction and OCR jobs

### Migration 00007 - Fix storage_key Constraint
- ✅ Converts `storage_key` unique constraint to partial index
- ✅ Allows re-uploading files that were previously soft-deleted
- ✅ Fixes "duplicate key value violates unique constraint" error

---

## ✅ Test It

After applying the migrations:

1. Go to your app: http://localhost:3000/app/new
2. Upload a PDF file
3. The error should be gone!

---

## 🔍 Troubleshooting

### Error: "column already exists"
This is OK! It means that column was already added. The script uses `IF NOT EXISTS` to be safe.

### Error: "permission denied"
Make sure you're logged into the correct Supabase project. The link above should take you directly to the right project.

### Still getting errors?
1. Check the Supabase Dashboard for any error messages
2. Verify you're in the right project: `iqspeaeuxpeijyncoiua`
3. Make sure you have admin access to the database

---

## 📚 Files

- `APPLY_THIS.sql` - Combined migrations (use this!)
- `00004_document_ocr_schema.sql` - Individual migration #4
- `00005_document_jobs.sql` - Individual migration #5
- `00007_fix_storage_key_constraint.sql` - Individual migration #7
- `README_APPLY_MIGRATIONS.md` - This file

---

## 🔗 Quick Links

- [SQL Editor](https://supabase.com/dashboard/project/iqspeaeuxpeijyncoiua/sql/new)
- [Table Editor](https://supabase.com/dashboard/project/iqspeaeuxpeijyncoiua/editor)
- [Database Tables](https://supabase.com/dashboard/project/iqspeaeuxpeijyncoiua/database/tables)
