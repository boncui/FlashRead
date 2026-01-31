import type { Flashread, CreateFlashreadInput, UpdateFlashreadInput } from '../types/flashread';

export interface GetFlashreadsResult {
  data: Flashread[];
  error?: string;
}

export interface GetFlashreadResult {
  data: Flashread | null;
  error?: string;
}

export interface CreateFlashreadResult {
  data?: Flashread;
  error?: string;
}

export interface UpdateFlashreadResult {
  data?: Flashread;
  error?: string;
}

export interface DeleteFlashreadResult {
  error?: string;
}

export type {
  CreateFlashreadInput,
  UpdateFlashreadInput
};
