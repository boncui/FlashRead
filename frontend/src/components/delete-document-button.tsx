'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { deleteDocument } from '@flashread/backend/actions';
import { Button } from '@/components/ui/button';

interface DeleteDocumentButtonProps {
  documentId: string;
  documentName: string;
}

export function DeleteDocumentButton({ documentId, documentName }: DeleteDocumentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (window.confirm(`Delete "${documentName}"? This action cannot be undone.`)) {
      startTransition(async () => {
        try {
          await deleteDocument(documentId);
          router.push('/app');
          router.refresh();
        } catch (error) {
          console.error('Failed to delete document:', error);
          alert('Failed to delete document. Please try again.');
        }
      });
    }
  };

  return (
    <Button
      onClick={handleDelete}
      disabled={isPending}
      variant="destructive"
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
