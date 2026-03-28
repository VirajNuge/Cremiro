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

/* ------------------------------------------------------------------ */
/*  YouTube URL Validation (server-side)                               */
/* ------------------------------------------------------------------ */

const YOUTUBE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)?$/;

/** Validate a YouTube URL and extract the video ID */
export function validateYouTubeUrl(url: string): ValidationResult & { videoId?: string } {
  if (!url) return { ok: false, message: "YouTube URL is required." };
  if (url.length > 2048) return { ok: false, message: "URL is too long." };

  const match = url.trim().match(YOUTUBE_REGEX);
  if (!match || !match[1]) {
    return { ok: false, message: "Please enter a valid YouTube or Shorts URL." };
  }

  return { ok: true, videoId: match[1] };
}

/* ------------------------------------------------------------------ */
/*  Generate Request Validation                                        */
/* ------------------------------------------------------------------ */

const VALID_JOB_TYPES = ["viral_clip", "social_text", "blog_post", "ai_image"] as const;
const VALID_PLATFORMS = ["tiktok", "reels", "shorts", "linkedin", "twitter"] as const;
const VALID_STYLES = ["minimalist", "fast_talker", "cinematic"] as const;

const CREDIT_COSTS: Record<string, number> = {
  viral_clip: 1,
  social_text: 0,
  blog_post: 5,
  ai_image: 5,
};

const MAX_QUANTITIES: Record<string, number> = {
  viral_clip: 20,
  social_text: 1,
  blog_post: 5,
  ai_image: 5,
};

export interface GenerateJobItem {
  job_type: string;
  quantity: number;
  platforms?: string[];
  style?: string;
}

export interface ValidatedGenerateRequest {
  youtubeUrl: string;
  videoId: string;
  items: GenerateJobItem[];
  totalCredits: number;
}

/** Validate the full generate request payload */
export function validateGenerateRequest(
  raw: Record<string, unknown>
): ValidationResult & { data?: ValidatedGenerateRequest } {
  // Validate YouTube URL
  const youtubeUrl = sanitizeString(raw.youtubeUrl);
  const urlCheck = validateYouTubeUrl(youtubeUrl);
  if (!urlCheck.ok) return urlCheck;

  // Validate items array
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return { ok: false, message: "At least one content type must be selected." };
  }

  if (raw.items.length > 10) {
    return { ok: false, message: "Too many content items in request." };
  }

  const validatedItems: GenerateJobItem[] = [];
  let totalCredits = 0;

  for (const item of raw.items) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, message: "Invalid item in request." };
    }

    const rawItem = item as Record<string, unknown>;
    const jobType = sanitizeString(rawItem.job_type);

    if (!VALID_JOB_TYPES.includes(jobType as typeof VALID_JOB_TYPES[number])) {
      return { ok: false, message: `Invalid content type: ${jobType}` };
    }

    const quantity = typeof rawItem.quantity === "number" ? Math.floor(rawItem.quantity) : 1;
    if (quantity < 1 || quantity > (MAX_QUANTITIES[jobType] ?? 1)) {
      return { ok: false, message: `Invalid quantity for ${jobType}. Max: ${MAX_QUANTITIES[jobType] ?? 1}` };
    }

    // Validate platforms (required for viral_clip)
    let platforms: string[] | undefined;
    if (jobType === "viral_clip") {
      if (!Array.isArray(rawItem.platforms) || rawItem.platforms.length === 0) {
        return { ok: false, message: "At least one platform must be selected for video clips." };
      }
      platforms = [];
      for (const p of rawItem.platforms) {
        const platform = sanitizeString(p);
        if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
          return { ok: false, message: `Invalid platform: ${platform}` };
        }
        platforms.push(platform);
      }
    }

    // Validate style (optional, only for viral_clip)
    let style: string | undefined;
    if (jobType === "viral_clip" && rawItem.style) {
      style = sanitizeString(rawItem.style);
      if (!VALID_STYLES.includes(style as typeof VALID_STYLES[number])) {
        return { ok: false, message: `Invalid style: ${style}` };
      }
    }

    const creditCost = (CREDIT_COSTS[jobType] ?? 0) * quantity;
    totalCredits += creditCost;

    validatedItems.push({
      job_type: jobType,
      quantity,
      ...(platforms && { platforms }),
      ...(style && { style }),
    });
  }

  return {
    ok: true,
    data: {
      youtubeUrl,
      videoId: urlCheck.videoId!,
      items: validatedItems,
      totalCredits,
    },
  };
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
