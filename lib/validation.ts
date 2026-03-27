/**
 * Server-side only validation utilities.
 * Never import this in client components.
 */

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Sanitize a string: trim + collapse whitespace */
export function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

/** Validate email format */
export function validateEmail(email: string): ValidationResult {
  if (!email) return { ok: false, message: "Email is required." };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { ok: false, message: "Invalid email format." };
  if (email.length > 254) return { ok: false, message: "Email is too long." };
  return { ok: true };
}

/** Validate password strength */
export function validatePassword(password: string): ValidationResult {
  if (!password) return { ok: false, message: "Password is required." };
  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  if (password.length > 128) return { ok: false, message: "Password is too long." };
  if (!/[A-Z]/.test(password)) return { ok: false, message: "Password must contain at least one uppercase letter." };
  if (!/[a-z]/.test(password)) return { ok: false, message: "Password must contain at least one lowercase letter." };
  if (!/[0-9]/.test(password)) return { ok: false, message: "Password must contain at least one number." };
  return { ok: true };
}

/** Validate username */
export function validateUsername(username: string): ValidationResult {
  if (!username) return { ok: false, message: "Username is required." };
  if (username.length < 3) return { ok: false, message: "Username must be at least 3 characters." };
  if (username.length > 30) return { ok: false, message: "Username must be 30 characters or fewer." };
  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(username)) {
    return { ok: false, message: "Username can only contain letters, numbers, underscores, dots, and hyphens." };
  }
  return { ok: true };
}

/** Validate name field (first/last) */
export function validateName(name: string, field: string): ValidationResult {
  if (!name) return { ok: false, message: `${field} is required.` };
  if (name.length < 1) return { ok: false, message: `${field} is required.` };
  if (name.length > 50) return { ok: false, message: `${field} must be 50 characters or fewer.` };
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(name)) {
    return { ok: false, message: `${field} contains invalid characters.` };
  }
  return { ok: true };
}
