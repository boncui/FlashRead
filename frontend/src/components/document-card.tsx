'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Document } from '@flashread/dependencies/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentStatusBadge } from '@/components/document-status';
import { deleteDocument } from '@flashread/backend/actions';

interface DocumentCardProps {
  document: Document;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function DocumentCard({ document }: DocumentCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Always link to document detail page (which has reading mode when ready)
  const href = `/app/documents/${document.id}`;

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.confirm(`Delete "${document.name}"? This action cannot be undone.`)) {
      startTransition(async () => {
        try {
          await deleteDocument(document.id);
          router.refresh();
        } catch (error) {
          console.error('Failed to delete document:', error);
          alert('Failed to delete document. Please try again.');
        }
      });
    }
  };

  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full relative group">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl truncate flex-1">{document.name}</CardTitle>
            <div className="flex items-center gap-2">
              <DocumentStatusBadge status={document.status} />
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-destructive disabled:opacity-50"
                aria-label="Delete document"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(document.created_at).toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-medium uppercase">{document.file_type}</span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span className="font-medium">{formatFileSize(document.size_bytes)}</span>
            </div>
            {document.page_count && (
              <div className="flex justify-between">
                <span>Pages:</span>
                <span className="font-medium">{document.page_count}</span>
              </div>
            )}
          </div>
          {document.status === 'ready' && document.derived_content?.flashread_v1 && (
            <div className="mt-3 pt-3 border-t">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <PlayIcon className="w-4 h-4" />
                Ready to Read
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
