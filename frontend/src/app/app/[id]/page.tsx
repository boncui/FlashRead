import { notFound } from 'next/navigation';
import { getFlashread } from '@flashread/backend/actions/flashreads';
import { FlashreadDetailClient } from '@/components/flashread-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FlashreadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const flashread = await getFlashread(id);

  if (!flashread) {
    notFound();
  }

  return <FlashreadDetailClient flashread={flashread} />;
}
