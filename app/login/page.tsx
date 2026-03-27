"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          {/* Abstract playful illustration with CSS */}
          <div className="relative">
            {/* Balancing elements */}
            <motion.div
              animate={{ rotate: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              {/* Main character silhouette (abstract) */}
              <div className="w-32 h-48 mx-auto mb-8 relative">
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-32 rounded-t-full"
                  style={{ backgroundColor: "#16423c" }}
                ></div>
                <div
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full"
                  style={{ backgroundColor: "#16423c" }}
                ></div>
              </div>

              {/* Circles being balanced */}
              <div className="flex justify-center gap-8 mb-8">
                <motion.div
                  animate={{ y: [-10, 10, -10] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl"
                  style={{ backgroundColor: "#ffd700" }}
                >
                  😊
                </motion.div>
                <motion.div
                  animate={{ y: [10, -10, 10] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl"
                  style={{ backgroundColor: "#90EE90" }}
                >
                  😄
                </motion.div>
              </div>

              {/* Bottom circle */}
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl"
                style={{ backgroundColor: "#ff6b6b" }}
              >
                😢
              </motion.div>
            </motion.div>

            {/* Decorative elements */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute top-10 left-10 text-4xl"
            >
              ✨
            </motion.div>
            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute top-20 right-10 text-3xl"
            >
              ⭐
            </motion.div>
            <motion.div
              animate={{ x: [-5, 5, -5] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute bottom-20 left-20 text-2xl"
            >
              ☁️
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Logo/Brand */}
          <Link href="/">
            <motion.div
              className="text-3xl font-bold mb-8 cursor-pointer"
              style={{ color: "#16423c" }}
              whileHover={{ scale: 1.05 }}
            >
              YT to Content
            </motion.div>
          </Link>

          {/* Welcome Text */}
          <h1 className="text-4xl font-bold mb-2" style={{ color: "#16423c" }}>
            Welcome Back!
          </h1>
          <p className="text-gray-600 mb-8">
            Log in to continue your journey toward clarity, balance and to your
            Safe Space.
          </p>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
                style={{ focusRing: "#fd6333" } as any}
                placeholder="username"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all pr-12"
                  placeholder="********"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: "#fd6333" }}
                  disabled={loading}
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm hover:underline"
                style={{ color: "#16423c" }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#fd6333" }}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or continue with</span>
            </div>
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 px-4 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M19.8 10.2273C19.8 9.51819 19.7364 8.83637 19.6182 8.18182H10.2V12.05H15.5818C15.3273 13.3 14.5636 14.3591 13.4182 15.0682V17.5773H16.7364C18.7091 15.8364 19.8 13.2727 19.8 10.2273Z"
                fill="#4285F4"
              />
              <path
                d="M10.2 20C12.9 20 15.1636 19.1045 16.7364 17.5773L13.4182 15.0682C12.4636 15.6682 11.2364 16.0227 10.2 16.0227C7.59546 16.0227 5.39091 14.2636 4.54091 11.9H1.11365V14.4909C2.67818 17.5909 6.20909 20 10.2 20Z"
                fill="#34A853"
              />
              <path
                d="M4.54091 11.9C4.32272 11.3 4.2 10.6591 4.2 10C4.2 9.34091 4.32272 8.7 4.54091 8.1V5.50909H1.11365C0.440905 6.85909 0 8.38182 0 10C0 11.6182 0.440905 13.1409 1.11365 14.4909L4.54091 11.9Z"
                fill="#FBBC05"
              />
              <path
                d="M10.2 3.97727C11.3364 3.97727 12.3591 4.35909 13.1636 5.12727L16.1091 2.18182C15.1591 1.31818 12.9 0 10.2 0C6.20909 0 2.67818 2.40909 1.11365 5.50909L4.54091 8.1C5.39091 5.73636 7.59546 3.97727 10.2 3.97727Z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>

          {/* Sign Up Link */}
          <p className="text-center mt-6 text-sm text-gray-600">
            Not a member?{" "}
            <Link
              href="/signup"
              className="font-semibold hover:underline"
              style={{ color: "#fd6333" }}
            >
              Join now
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
