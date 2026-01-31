'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { CreateFlashreadInput, UpdateFlashreadInput, Flashread } from '../lib/types';

export async function getFlashreads(): Promise<Flashread[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('flashreads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data as Flashread[];
}

export async function getFlashread(id: string): Promise<Flashread | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('flashreads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  return data as Flashread;
}

export async function createFlashread(input: CreateFlashreadInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('flashreads')
    .insert({
      user_id: user.id,
      title: input.title || 'Untitled',
      source_text: input.source_text,
      render_config: input.render_config || {},
      rendered_blocks: input.rendered_blocks,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app');
  redirect(`/app/${data.id}`);
}

export async function updateFlashread(id: string, input: UpdateFlashreadInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    updateData.title = input.title;
  }
  if (input.source_text !== undefined) {
    updateData.source_text = input.source_text;
  }
  if (input.render_config !== undefined) {
    updateData.render_config = input.render_config;
  }
  if (input.rendered_blocks !== undefined) {
    updateData.rendered_blocks = input.rendered_blocks;
  }

  const { error } = await supabase
    .from('flashreads')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app');
  revalidatePath(`/app/${id}`);
}

export async function deleteFlashread(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('flashreads')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app');
  redirect('/app');
}
