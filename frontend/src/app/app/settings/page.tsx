'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateEmail, deleteAccount } from '@flashread/backend/actions/auth';
import { RsvpSettingsCard } from '@/components/rsvp/RsvpSettingsCard';

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setIsUpdatingEmail(true);

    try {
      const result = await updateEmail(email);
      if (result?.error) {
        setEmailError(result.error);
      } else {
        setEmailSuccess('Email updated successfully! Please check your new email for confirmation.');
        setEmail('');
      }
    } catch (error) {
      setEmailError('An unexpected error occurred');
    } finally {
      setIsUpdatingEmail(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await deleteAccount();
    } catch (error) {
      setIsDeleting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-4 sm:py-8 px-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-8">Account Settings</h1>

      <div className="space-y-6">
        {/* RSVP Settings */}
        <RsvpSettingsCard />

        {/* Update Email */}
        <Card>
          <CardHeader>
            <CardTitle>Update Email</CardTitle>
            <CardDescription>
              Change your account email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">New Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="new@example.com"
                  required
                  disabled={isUpdatingEmail}
                />
              </div>
              {emailError && (
                <p className="text-sm text-red-600">{emailError}</p>
              )}
              {emailSuccess && (
                <p className="text-sm text-green-600">{emailSuccess}</p>
              )}
              <Button type="submit" disabled={isUpdatingEmail}>
                {isUpdatingEmail ? 'Updating...' : 'Update Email'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card>
          <CardHeader>
            <CardTitle>Delete Account</CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showDeleteConfirm ? (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure? This action cannot be undone. All your flashreads will be permanently deleted.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
