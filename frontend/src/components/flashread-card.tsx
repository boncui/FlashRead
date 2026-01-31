import Link from 'next/link';
import { Flashread } from '@flashread/dependencies/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FlashreadCardProps {
  flashread: Flashread;
}

export function FlashreadCard({ flashread }: FlashreadCardProps) {
  const preview =
    flashread.source_text.substring(0, 150) +
    (flashread.source_text.length > 150 ? '...' : '');

  return (
    <Link href={`/app/${flashread.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <CardTitle className="text-xl">{flashread.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {new Date(flashread.created_at).toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {preview}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
