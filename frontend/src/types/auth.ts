/**
 * TypeScript types for authentication.
 * Mirrors backend schemas/user.py.
 */

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  email_notifications?: boolean;
  ai_provider?: "openai" | "anthropic" | "auto";
  [key: string]: unknown;
}

export type UserRole = "user" | "admin" | "super_admin";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  tier: "free" | "pro" | "enterprise";
  role: UserRole;
  preferences: UserPreferences;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  // refresh_token is now in httpOnly cookie, not in JSON response
}

export interface LoginResponse {
  tokens: TokenResponse;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
