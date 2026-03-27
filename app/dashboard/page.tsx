"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */

function IconPersona({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconGenerate({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4 5.6 21.2 8 14 2 9.2h7.6z" />
    </svg>
  );
}

function IconSchedule({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconSettings({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconDocs({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconSignOut({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconCredits({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 0 1 0 4H8" />
      <line x1="12" y1="6" x2="12" y2="8" />
      <line x1="12" y1="16" x2="12" y2="18" />
    </svg>
  );
}

function IconMenu({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar Component                                                   */
/* ------------------------------------------------------------------ */

function UserAvatar({
  user,
  size = 48,
}: {
  user: { first_name?: string | null; last_name?: string | null; full_name?: string | null; email?: string; user_metadata?: Record<string, unknown> };
  size?: number;
}) {
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initials = [user.first_name?.[0], user.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white select-none"
      style={{ width: size, height: size, backgroundColor: "#fd6333", fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar Nav Item                                                   */
/* ------------------------------------------------------------------ */

function NavItem({
  icon,
  label,
  active = false,
  onClick,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "text-white"
          : accent
          ? "text-red-500 hover:bg-red-50"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
      style={
        active
          ? { backgroundColor: "#fd6333", color: "#ffffff" }
          : accent
          ? { color: "#fd6333" }
          : undefined
      }
    >
      {icon}
      <span>{label}</span>
    </motion.button>
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
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-2xl p-6 border border-gray-100 text-left w-full group cursor-pointer transition-colors"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors"
        style={{ backgroundColor: "#fd633315" }}
      >
        <span style={{ color: "#fd6333" }}>{icon}</span>
      </div>
      <h3 className="text-lg font-semibold mb-1" style={{ color: "#16423c" }}>
        {title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </motion.button>
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

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "#fd6333", borderTopColor: "transparent" }}
          ></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.first_name || user.full_name?.split(" ")[0] || "there";

  /* Sidebar content — shared between desktop and mobile */
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xl font-bold tracking-tight"
          style={{ color: "#16423c" }}
        >
          Cremiro
        </motion.span>
      </div>

      {/* Profile Section */}
      <div className="px-6 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} size={44} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#16423c" }}>
              {user.full_name || user.email}
            </p>
            {user.username && (
              <p className="text-xs text-gray-400 truncate">@{user.username}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <p className="px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
          Features
        </p>
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

      {/* Bottom Navigation */}
      <div className="px-3 pb-4 space-y-1 border-t border-gray-100 pt-4">
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
          accent
          onClick={handleSignOut}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* ---- Desktop Sidebar ---- */}
      <aside className="hidden md:flex md:flex-col fixed inset-y-0 left-0 w-[260px] bg-white border-r border-gray-100 z-30">
        {sidebarContent}
      </aside>

      {/* ---- Mobile Top Bar ---- */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-100 z-40 flex items-center justify-between px-4">
        <span className="text-lg font-bold" style={{ color: "#16423c" }}>
          Cremiro
        </span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {sidebarOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      {/* ---- Mobile Sidebar Overlay ---- */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/30 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="md:hidden fixed inset-y-0 left-0 w-[260px] bg-white z-50 shadow-xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ---- Main Content ---- */}
      <main className="md:ml-[260px] pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Top Section: Greeting + Credits */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10"
          >
            <div>
              <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "#16423c" }}>
                Hello, {displayName}
              </h1>
              <p className="text-lg mt-1" style={{ color: "#fd6333" }}>
                How can I help you today?
              </p>
            </div>

            {/* Credits Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm"
            >
              <IconCredits className="w-4 h-4" />
              <span className="text-sm font-semibold" style={{ color: "#16423c" }}>
                1,000
              </span>
              <span className="text-xs text-gray-400">Credits</span>
            </motion.div>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            <FeatureCard
              icon={<IconPersona className="w-5 h-5" />}
              title="Persona"
              description="Define your brand voice and content style to generate consistent, on-brand output."
              delay={0.1}
            />
            <FeatureCard
              icon={<IconGenerate className="w-5 h-5" />}
              title="Generate"
              description="Transform YouTube videos into blog posts, social media content, and more."
              delay={0.2}
            />
            <FeatureCard
              icon={<IconSchedule className="w-5 h-5" />}
              title="Schedule"
              description="Plan and schedule your generated content across platforms."
              delay={0.3}
            />
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="bg-white rounded-2xl border border-gray-100 p-6"
          >
            <h2 className="text-xl font-semibold mb-4" style={{ color: "#16423c" }}>
              Getting Started
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              Welcome to Cremiro. Start by setting up your Persona to define your content voice, then use Generate to transform YouTube videos into polished content.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "#fd6333" }}
                onClick={() => setActiveNav("persona")}
              >
                Set Up Persona
              </button>
              <button
                className="px-5 py-2.5 rounded-lg text-sm font-semibold border transition-all hover:bg-gray-50"
                style={{ color: "#16423c", borderColor: "#e5e7eb" }}
                onClick={() => setActiveNav("generate")}
              >
                Start Generating
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
