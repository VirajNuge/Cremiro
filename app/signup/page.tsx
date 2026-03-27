"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!agreeToTerms) {
      setError("Please agree to the Terms of Service");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    }
  };

  const handleGoogleSignup = async () => {
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
    <div className="min-h-screen bg-white">
      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full h-screen overflow-hidden"
      >
        <div className="grid md:grid-cols-2 h-screen">
          {/* Left Side - Illustration */}
          <div className="hidden md:flex flex-col items-center justify-center p-12 relative" style={{ backgroundColor: "#e8f0fd" }}>
            {/* Logo */}
            <Link href="/">
              <motion.div
                className="absolute top-8 left-8 text-2xl font-bold cursor-pointer"
                style={{ color: "#16423c" }}
                whileHover={{ scale: 1.05 }}
              >
                YT to Content
              </motion.div>
            </Link>

            {/* Growing tree illustration */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="relative"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                >
                  {/* Tree trunk */}
                  <div
                    className="w-8 h-40 mx-auto rounded-t-full"
                    style={{ backgroundColor: "#16423c" }}
                  />

                  {/* Flowers/leaves in circle */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                      className="relative w-full h-full"
                    >
                      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                          className="absolute w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg"
                          style={{
                            backgroundColor:
                              i % 3 === 0 ? "#fd6333" : i % 3 === 1 ? "#90EE90" : "#ffd700",
                            left: `${50 + 38 * Math.cos((angle * Math.PI) / 180)}%`,
                            top: `${50 + 38 * Math.sin((angle * Math.PI) / 180)}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          {["🌱", "🌿", "🌳", "🌸", "🌺", "🌼"][i]}
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              {/* Decorative sparkles */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-12 right-8 text-4xl"
              >
                ✨
              </motion.div>
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-8 left-8 text-3xl"
              >
                🌟
              </motion.div>
            </motion.div>
          </div>

          {/* Right Side - Form */}
          <div className="flex items-center justify-center p-8 md:p-12">
            <div className="w-full max-w-sm">
              {/* Mobile Logo */}
              <Link href="/">
                <motion.div
                  className="md:hidden text-2xl font-bold mb-8 text-center"
                  style={{ color: "#16423c" }}
                  whileHover={{ scale: 1.05 }}
                >
                  YT to Content
                </motion.div>
              </Link>

              {/* Welcome Text */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: "#16423c" }}>
                  Join Us Today!
                </h1>
                <p className="text-gray-600 text-sm mb-6">
                  Create your account and start transforming YouTube content into valuable insights.
                </p>
              </motion.div>

              {/* Success Message */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm"
                >
                  Account created successfully! Redirecting...
                </motion.div>
              )}

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

              {/* Signup Form */}
              <form onSubmit={handleEmailSignup} className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
                    placeholder="your.email@example.com"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 pr-10 text-sm"
                      placeholder="At least 6 characters"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                      disabled={loading}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
                    placeholder="Re-enter your password"
                    disabled={loading}
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="w-4 h-4 rounded mt-0.5"
                    style={{ accentColor: "#fd6333" }}
                    disabled={loading}
                  />
                  <label htmlFor="terms" className="text-xs text-gray-600">
                    I agree to the{" "}
                    <Link href="/terms" className="hover:underline" style={{ color: "#16423c" }}>
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="hover:underline" style={{ color: "#16423c" }}>
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-4"
                  style={{ backgroundColor: "#fd6333" }}
                >
                  {loading ? "Creating account..." : "Sign up"}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white text-gray-500">or continue with</span>
                </div>
              </div>

              {/* Social Login - Icon Buttons */}
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={loading}
                  className="w-12 h-12 rounded-full border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#16423c" }}
                  title="Sign up with Google"
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
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className="w-12 h-12 rounded-full border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#16423c" }}
                  title="Sign up with Apple"
                >
                  <svg width="16" height="20" viewBox="0 0 16 20" fill="white">
                    <path d="M15.5 14.5c-.3.8-.7 1.5-1.1 2.2-.6.9-1.1 1.5-1.5 1.9-.6.6-1.3.9-2.1.9-.5 0-1.2-.2-2-.5s-1.4-.5-2-.5c-.6 0-1.3.2-2.1.5s-1.4.5-1.9.5c-.8.1-1.5-.3-2.1-.9-.5-.4-1-.9-1.6-1.9-.6-1.1-1.1-2.3-1.5-3.7C-1.1 11.8-.9 10.7-.9 9.7c0-1.2.3-2.3.8-3.2.5-.8 1.2-1.4 2-1.9.8-.5 1.7-.7 2.7-.8.5 0 1.2.2 2.1.5.9.3 1.5.5 1.8.5.2 0 .9-.2 2-.6s2-.6 2.3-.6c.8 0 1.6.3 2.3.8.4.3.8.7 1.1 1.1-.4.3-.8.6-1.1 1-.6.7-.9 1.5-.9 2.3 0 .8.2 1.5.7 2.1.4.6.9 1 1.5 1.3-.1.3-.3.7-.5 1.1zm-3.9-15c.4.5.7 1.1.9 1.8.1.5.1 1 0 1.5h-.1c-.3 0-.7-.1-1.2-.3-.6-.2-1.1-.6-1.6-1.1-.4-.5-.7-1-.9-1.6-.1-.5-.2-.9-.2-1.4v-.1c.3 0 .6.1 1 .2.6.2 1.2.5 1.7 1z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className="w-12 h-12 rounded-full border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#16423c" }}
                  title="Sign up with Facebook"
                >
                  <svg width="10" height="20" viewBox="0 0 10 20" fill="white">
                    <path d="M8.5 3.5h-2c-.3 0-.5.2-.5.5v2h2.5c.2 0 .3.1.3.3l-.4 2.5c0 .1-.2.2-.3.2H6v7c0 .3-.2.5-.5.5h-3c-.3 0-.5-.2-.5-.5v-7H.5c-.3 0-.5-.2-.5-.5v-2c0-.3.2-.5.5-.5H2V3.5C2 1.6 3.6 0 5.5 0h3c.3 0 .5.2.5.5v2.5c0 .3-.2.5-.5.5z"/>
                  </svg>
                </button>
              </div>

              {/* Login Link */}
              <p className="text-center mt-5 text-sm text-gray-600">
                Already a member?{" "}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: "#fd6333" }}>
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
