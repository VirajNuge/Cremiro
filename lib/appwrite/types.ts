export type AppwriteRow = {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
  $permissions?: string[];
  [key: string]: unknown;
};

export type ProfileRow = AppwriteRow & {
  user_id: string;
  username: string;
  username_hash: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  credits_balance: number;
};

export type RequestRow = AppwriteRow & {
  user_id: string;
  youtube_url: string;
  status: "pending" | "processing" | "completed" | "partially_completed" | "failed";
  total_credits: number;
  input_data: Record<string, unknown>;
  idempotency_key?: string | null;
  worker_stage?: string | null;
  worker_cursor?: number;
};

export type JobItemRow = AppwriteRow & {
  request_id: string;
  user_id: string;
  job_type: "viral_clip" | "social_text" | "blog_post" | "ai_image";
  status: "pending" | "processing" | "completed" | "failed";
  credits_cost: number;
  platform?: string | null;
  style?: string | null;
  input_data: Record<string, unknown>;
  output_data?: Record<string, unknown> | null;
  output_file_ids?: string[] | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  refunded_at?: string | null;
  refund_txn_id?: string | null;
};

export type AuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  created_at?: string;
  user_metadata?: {
    avatar_url?: string | null;
    full_name?: string | null;
  };
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  credits_balance?: number;
};
