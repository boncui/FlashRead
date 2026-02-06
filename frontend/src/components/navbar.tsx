'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut } from '@flashread/backend/actions/auth';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
  }

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/app" className="text-2xl font-bold">
          FlashRead
        </Link>
        
        {/* Desktop menu */}
        <div className="hidden sm:flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost">Settings</Button>
          </Link>
          <Button onClick={handleSignOut} variant="ghost">
            Sign Out
          </Button>
        </div>

        {/* Mobile hamburger button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t bg-background">
          <div className="container mx-auto px-4 py-2 flex flex-col gap-2">
            <Link href="/app/settings" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                Settings
              </Button>
            </Link>
            <Button
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignOut();
              }}
              variant="ghost"
              className="w-full justify-start"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
