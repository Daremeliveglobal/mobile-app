/**
 * Authentication API types
 * Login, registration, and user management
 */

// === User Interface ===
export interface User {
  id: number;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  short_name: string;
  phone_number: string | null;
  gender: 'male' | 'female' | 'other' | null;
  country: string | null;
  interests: string | null; // Backend stores as comma-separated string
  language: string;
  profile_completed: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_content_creator: boolean;
  has_accepted_terms: boolean;
  vip_level: 'basic' | 'premium' | 'vip' | 'vvip';
  // Profile picture
  profile_picture: string | null;
  profile_picture_url: string | null;
  // Social stats
  followers_count: number;
  following_count: number;
  total_likes_count: number;
  created_at: string;
  updated_at: string;
}

// === Authentication Responses ===
export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

// === Authentication Requests ===
export interface SignupRequest {
  email: string;
  password: string;
  confirm_password: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
  purpose: 'signup' | 'reset';
}

export interface ResendOTPRequest {
  email: string;
  purpose: 'signup' | 'reset';
}

// === Profile Completion ===
export interface ProfileCompletionRequest {
  username: string;
  phone_number: string;
  gender: 'male' | 'female' | 'other'; // Backend expects lowercase
  country: string;
  has_accepted_terms: boolean;
}

export interface ProfileCompletionResponse {
  message: string;
  user: User;
}

// === Profile Management ===
export interface UpdateProfileRequest {
  username?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  country?: string;
  interests?: string; // Backend expects string, not array
  language?: string;
}

export interface ProfilePictureUploadResponse {
  message: string;
  user: User;
}

// === Password Management ===
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetVerifyRequest {
  email: string;
  otp: string;
}

export interface PasswordResetVerifyResponse {
  message: string;
  /** Short-lived token proving the emailed code was entered correctly. */
  reset_token: string;
}

export interface PasswordResetConfirmRequest {
  reset_token: string;
  new_password: string;
  confirm_password: string;
}

// === Token Management ===
export interface RefreshTokenRequest {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
}

// === Account Management ===
export interface DeactivateAccountRequest {
  reason?: string;
}

export interface LogoutRequest {
  refresh: string;
}

// === OAuth ===
export interface GoogleAuthRequest {
  id_token: string;
}

export interface AppleAuthRequest {
  identity_token: string;
  // Apple only shares the name on the very first sign-in.
  first_name?: string;
  last_name?: string;
}

export interface DeleteAccountRequest {
  confirm: 'DELETE';
  reason?: string;
}

// === Common Response Types ===
export interface AuthMessageResponse {
  message: string;
}

export interface SignupResponse {
  message: string;
  email: string;
}

// === Legacy/Backward Compatibility ===
// These are kept for backward compatibility with existing code
export interface LoginRequest extends SigninRequest {}
export interface LoginResponse extends AuthResponse {}
export interface RegisterRequest extends SignupRequest {}
export interface ProfileUpdateRequest extends UpdateProfileRequest {}