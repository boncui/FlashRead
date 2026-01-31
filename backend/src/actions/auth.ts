'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';

export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/app');
}

export async function signUp(email: string, password: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/app');
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
  const supabase = await createClient();

  // Update email in Supabase Auth
  const { error: authError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (authError) {
    return { error: authError.message };
  }

  // Update email in profiles table
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ email: newEmail })
    .eq('id', (await supabase.auth.getUser()).data.user?.id);

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
