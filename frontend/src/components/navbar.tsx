import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@flashread/backend/actions/auth';

export function Navbar() {
  async function handleSignOut() {
    'use server';
    await signOut();
  }

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/app" className="text-2xl font-bold">
          FlashRead
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost">Settings</Button>
          </Link>
          <form action={handleSignOut}>
            <Button type="submit" variant="ghost">
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </nav>
  );
}
