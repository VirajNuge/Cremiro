"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GeneratePanel from "./GeneratePanel";

/* ------------------------------------------------------------------ */
/*  Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */

function IconPersona({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconGenerate({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconSchedule({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconSettings({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconDocs({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconSignOut({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconCredits({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 0 1 0 4H8" />
      <line x1="12" y1="6" x2="12" y2="8" />
      <line x1="12" y1="16" x2="12" y2="18" />
    </svg>
  );
}

function IconMenu({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconChevronDown({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconLink({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar Component                                                   */
/* ------------------------------------------------------------------ */

function UserAvatar({
  user,
  size = 36,
}: {
  user: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  size?: number;
}) {
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initials = [user.first_name?.[0], user.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() ||
    user.full_name?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white select-none flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: "#fd6333",
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar Nav Item — matches reference style                         */
/* ------------------------------------------------------------------ */

function NavItem({
  icon,
  label,
  active = false,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
        active
          ? "text-white"
          : danger
          ? "hover:bg-red-50/60"
          : "hover:bg-gray-100/80"
      }`}
      style={
        active
          ? { backgroundColor: "#fd6333", boxShadow: "0 2px 12px rgba(253,99,51,0.25)" }
          : undefined
      }
    >
      <span style={{ color: active ? "#fff" : danger ? "#f87171" : "#9ca3af" }}>
        {icon}
      </span>
      <span style={{ color: active ? "#fff" : danger ? "#ef4444" : "#6b7280" }}>
        {label}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature Card                                                       */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
  onClick?: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -3, boxShadow: "0 10px 32px rgba(0,0,0,0.07)" }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-gray-100/80 text-left w-full cursor-pointer"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3.5"
        style={{ backgroundColor: "#fd63330f" }}
      >
        <span style={{ color: "#fd6333" }}>{icon}</span>
      </div>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "#16423c" }}>
        {title}
      </h3>
      <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  OAuth Connect Banner (sidebar bottom card)                        */
/* ------------------------------------------------------------------ */

function OAuthBanner() {
  return (
    <div
      className="mx-3 mb-4 rounded-2xl p-4 relative overflow-hidden border border-gray-100"
      style={{ backgroundColor: "#f9fafb" }}
    >
      {/* decorative glow */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-xl"
        style={{ backgroundColor: "#fd6333" }}
      />

      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 relative z-10" style={{ color: "#fd6333" }}>
        · cremiro
      </p>
      <p className="text-[12px] leading-snug mb-3 relative z-10 text-gray-400">
        Connect your social platforms to start publishing generated content.
      </p>
      <button
        className="w-full flex items-center justify-center gap-1.5 border text-[12px] font-semibold rounded-xl py-2 transition-all duration-150 relative z-10 hover:bg-[#fd63330a]"
        style={{ borderColor: "#fd633330", color: "#fd6333" }}
      >
        <IconLink className="w-3.5 h-3.5" />
        Enable OAuth
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard Page                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<string>("persona");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const emailConfirmed = !!user?.email_confirmed_at;
  const showConfirmBanner = !emailConfirmed && !bannerDismissed;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-10 h-10 border-[3px] border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: "#fd6333", borderTopColor: "transparent" }}
          />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayName =
    user.first_name || user.full_name?.split(" ")[0] || "there";

  /* ── Sidebar content (shared desktop + mobile) ── */
  const sidebarContent = (
    <div className="flex flex-col h-full select-none">

      {/* ── Logo ── */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#fd6333" }}
        >
          <IconGenerate className="w-4 h-4 text-white" />
        </div>
        <span className="text-[16px] font-bold tracking-tight" style={{ color: "#16423c" }}>
          Cremiro
        </span>
      </div>

      {/* ── User Pill ── */}
      <div className="px-3 mb-4">
        <div
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-gray-100 bg-gray-50/80"
        >
          <div className="relative flex-shrink-0">
            <UserAvatar user={user} size={30} />
            {/* online indicator */}
            <span
              className="absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white"
              style={{ backgroundColor: "#22c55e" }}
            />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: "#16423c" }}>
              {user.full_name || user.email}
            </p>
            {user.username ? (
              <p className="text-[11px] truncate leading-tight text-gray-400">@{user.username}</p>
            ) : (
              <p className="text-[11px] leading-tight text-gray-400">Online</p>
            )}
          </div>
        </div>
        {/* Credits badge */}
        <div className="flex items-center gap-1.5 mt-2.5 px-1">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
            style={{ backgroundColor: "#fd63330d", borderColor: "#fd633325" }}
          >
            <span style={{ color: "#fd6333" }}>
              <IconCredits className="w-3 h-3" />
            </span>
            <span className="text-[11px] font-bold" style={{ color: "#fd6333" }}>
              {(user.credits_balance ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-gray-400">credits</span>
          </div>
        </div>
      </div>

      {/* ── Main Nav ── */}
      <div className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <NavItem
          icon={<IconPersona />}
          label="Persona"
          active={activeNav === "persona"}
          onClick={() => { setActiveNav("persona"); setSidebarOpen(false); }}
        />
        <NavItem
          icon={<IconGenerate />}
          label="Generate"
          active={activeNav === "generate"}
          onClick={() => { setActiveNav("generate"); setSidebarOpen(false); }}
        />
        <NavItem
          icon={<IconSchedule />}
          label="Schedule"
          active={activeNav === "schedule"}
          onClick={() => { setActiveNav("schedule"); setSidebarOpen(false); }}
        />
      </div>

      {/* ── Bottom Nav ── */}
      <div className="px-3 pt-2 pb-2 space-y-0.5 mt-2 border-t border-gray-100/80">
        <NavItem
          icon={<IconSettings />}
          label="Settings"
          onClick={() => setSidebarOpen(false)}
        />
        <NavItem
          icon={<IconDocs />}
          label="Documentation"
          onClick={() => setSidebarOpen(false)}
        />
        <NavItem
          icon={<IconSignOut />}
          label="Sign Out"
          danger
          onClick={handleSignOut}
        />
      </div>

      {/* ── OAuth Banner ── */}
      <OAuthBanner />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f7f8" }}>

      {/* ══ Desktop Sidebar ══ */}
      <aside
        className="hidden md:flex md:flex-col fixed inset-y-0 left-0 z-30 border-r border-gray-100/80 bg-white"
        style={{ width: 232 }}
      >
        {sidebarContent}
      </aside>

      {/* ══ Mobile Top Bar ══ */}
      <header
        className="md:hidden fixed top-0 inset-x-0 h-13 bg-white border-b border-gray-100 z-40 flex items-center justify-between px-4"
      >
        <span className="text-base font-bold" style={{ color: "#16423c" }}>
          Cremiro
        </span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          {sidebarOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      {/* ══ Mobile Sidebar Overlay ══ */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/25 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              key="sidebar"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="md:hidden fixed inset-y-0 left-0 bg-white z-50 shadow-2xl"
              style={{ width: 232 }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ══ Main Content ══ */}
      <main className="md:pl-[232px] pt-13 md:pt-0">

        {/* Email confirmation banner */}
        <AnimatePresence>
          {showConfirmBanner && (
            <motion.div
              key="confirm-banner"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 px-6 py-3 border-b border-amber-200"
              style={{ backgroundColor: "#fffbeb" }}
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-sm flex-1" style={{ color: "#92400e" }}>
                <strong>Confirm your email</strong> — Please check your inbox and verify your email address. Some features require a confirmed account.
              </p>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-amber-500 hover:text-amber-700 flex-shrink-0 ml-2"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {activeNav === "generate" ? (
          <GeneratePanel />
        ) : (
        <div className="max-w-4xl mx-auto px-6 py-8">

          {/* Greeting + Credits */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8"
          >
            <div>
              <h1 className="text-[28px] md:text-[32px] font-bold leading-tight" style={{ color: "#16423c" }}>
                Hello, {displayName}
              </h1>
              <p className="text-[15px] mt-0.5" style={{ color: "#fd6333" }}>
                How can I help you today?
              </p>
            </div>

            {/* Credits pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm self-start sm:self-auto"
            >
              <span style={{ color: "#fd6333" }}>
                <IconCredits className="w-3.5 h-3.5" />
              </span>
              <span className="text-[13px] font-bold" style={{ color: "#16423c" }}>
                {(user.credits_balance ?? 0).toLocaleString()}
              </span>
              <span className="text-[12px] text-gray-400 font-medium">Credits</span>
            </motion.div>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <FeatureCard
              icon={<IconPersona className="w-[18px] h-[18px]" />}
              title="Persona"
              description="Define your brand voice and content style for consistent, on-brand output."
              delay={0.08}
              onClick={() => setActiveNav("persona")}
            />
            <FeatureCard
              icon={<IconGenerate className="w-[18px] h-[18px]" />}
              title="Generate"
              description="Transform YouTube videos into blog posts, threads, and more."
              delay={0.16}
              onClick={() => setActiveNav("generate")}
            />
            <FeatureCard
              icon={<IconSchedule className="w-[18px] h-[18px]" />}
              title="Schedule"
              description="Plan and publish your generated content across platforms."
              delay={0.24}
              onClick={() => setActiveNav("schedule")}
            />
          </div>

          {/* Getting Started */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.35 }}
            className="bg-white rounded-2xl border border-gray-100/80 p-5"
          >
            <h2 className="text-[15px] font-semibold mb-1.5" style={{ color: "#16423c" }}>
              Getting Started
            </h2>
            <p className="text-[13px] text-gray-400 leading-relaxed mb-4">
              Welcome to Cremiro. Set up your Persona first, then use Generate to turn any YouTube video into polished content ready to publish.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: "#fd6333" }}
                onClick={() => setActiveNav("persona")}
              >
                Set Up Persona
              </button>
              <button
                className="px-4 py-2 rounded-lg text-[13px] font-semibold border transition-all hover:bg-gray-50 active:scale-95"
                style={{ color: "#16423c", borderColor: "#e5e7eb" }}
                onClick={() => setActiveNav("generate")}
              >
                Start Generating
              </button>
            </div>
          </motion.div>

        </div>
        )}
      </main>
    </div>
  );
}
