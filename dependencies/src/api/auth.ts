export interface AuthResult {
  error?: string;
  success?: boolean;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
}

export interface UpdateEmailInput {
  email: string;
}

export interface DeleteAccountResult {
  error?: string;
  success?: boolean;
}
