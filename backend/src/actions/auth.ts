'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';

// Validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 72; // bcrypt limit

function validateEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return 'Email is required';
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return 'Email is required';
  }
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return 'Email is too long';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid email address';
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return 'Password is too long';
  }
  return null;
}

export async function signIn(email: string, password: string) {
  // Validate inputs
  const emailError = validateEmail(email);
  if (emailError) {
    return { error: emailError };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function signUp(email: string, password: string) {
  // Validate inputs
  const emailError = validateEmail(email);
  if (emailError) {
    return { error: emailError };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    // Handle rate limit errors with a friendlier message
    if (error.message.toLowerCase().includes('rate limit')) {
      return { error: 'Too many signup attempts. Please wait a minute and try again.' };
    }
    return { error: error.message };
  }

  // Check if email confirmation is required
  // When user exists but no session, email confirmation is pending
  if (data.user && !data.session) {
    return {
      success: true,
      requiresConfirmation: true,
      message: 'Please check your email to confirm your account before signing in.',
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function updateEmail(newEmail: string) {
  // Validate email
  const emailError = validateEmail(newEmail);
  if (emailError) {
    return { error: emailError };
  }

  const supabase = await createClient();

  // Get user ID BEFORE making any changes to avoid race condition
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Update email in Supabase Auth
  const { error: authError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (authError) {
    return { error: authError.message };
  }

  // Update email in profiles table using stored user ID
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ email: newEmail })
    .eq('id', user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Soft delete: mark profile as deleted
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  // Sign out the user
  const { error: signOutError } = await supabase.auth.signOut();

  if (signOutError) {
    return { error: signOutError.message };
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}
