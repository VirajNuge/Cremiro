/**
 * Server-side only validation utilities.
 * Never import this in client components.
 */

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Reserved usernames that cannot be registered.
 * Prevents impersonation of system routes and well-known names.
 */
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "superuser", "sysadmin",
  "api", "auth", "login", "logout", "signup", "register", "me",
  "account", "accounts", "profile", "profiles", "settings", "config",
  "dashboard", "home", "index", "help", "support", "contact",
  "about", "terms", "privacy", "legal", "blog", "news",
  "static", "assets", "public", "www", "mail", "email",
  "null", "undefined", "true", "false",
  "moderator", "mod", "staff", "team", "official",
]);

/** Sanitize a string: trim + collapse internal whitespace */
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

/**
 * Validate password strength.
 * Rules: 8–128 chars, at least one uppercase, one lowercase, one digit, one special char.
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) return { ok: false, message: "Password is required." };
  if (password.length < 8)
    return { ok: false, message: "Password must be at least 8 characters." };
  if (password.length > 128)
    return { ok: false, message: "Password is too long." };
  if (!/[A-Z]/.test(password))
    return { ok: false, message: "Password must contain at least one uppercase letter." };
  if (!/[a-z]/.test(password))
    return { ok: false, message: "Password must contain at least one lowercase letter." };
  if (!/[0-9]/.test(password))
    return { ok: false, message: "Password must contain at least one number." };
  if (!/[^a-zA-Z0-9]/.test(password))
    return { ok: false, message: "Password must contain at least one special character (e.g. !@#$%)." };
  return { ok: true };
}

/**
 * Validate username.
 * Rules:
 * - 3–30 characters
 * - Only letters, numbers, underscores, dots, hyphens
 * - Must start and end with a letter or number (no leading/trailing . or -)
 * - No consecutive special characters (e.g. "user..name")
 * - Not a reserved system name
 */
export function validateUsername(username: string): ValidationResult {
  if (!username) return { ok: false, message: "Username is required." };
  if (username.length < 3)
    return { ok: false, message: "Username must be at least 3 characters." };
  if (username.length > 30)
    return { ok: false, message: "Username must be 30 characters or fewer." };

  // Only allowed characters
  if (!/^[a-zA-Z0-9_.-]+$/.test(username))
    return { ok: false, message: "Username can only contain letters, numbers, underscores, dots, and hyphens." };

  // Must start and end with alphanumeric
  if (!/^[a-zA-Z0-9]/.test(username))
    return { ok: false, message: "Username must start with a letter or number." };
  if (!/[a-zA-Z0-9]$/.test(username))
    return { ok: false, message: "Username must end with a letter or number." };

  // No consecutive special characters (e.g. "user..name", "user--name")
  if (/[_.\-]{2,}/.test(username))
    return { ok: false, message: "Username cannot contain consecutive special characters." };

  // Reserved names (case-insensitive)
  if (RESERVED_USERNAMES.has(username.toLowerCase()))
    return { ok: false, message: "That username is not available." };

  return { ok: true };
}

/** Validate name field (first/last name) */
export function validateName(name: string, field: string): ValidationResult {
  if (!name) return { ok: false, message: `${field} is required.` };
  if (name.length > 50)
    return { ok: false, message: `${field} must be 50 characters or fewer.` };
  // Allow letters, spaces, hyphens, apostrophes (e.g. "O'Brien", "Mary-Jane")
  if (!/^[a-zA-Z\s'-]+$/.test(name))
    return { ok: false, message: `${field} contains invalid characters.` };
  return { ok: true };
}
