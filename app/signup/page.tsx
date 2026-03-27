"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const resetCaptcha = () => {
    captchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!agreeToTerms) {
      setError("Please agree to the Terms of Service.");
      setLoading(false);
      return;
    }

    if (!captchaToken) {
      setError("Please complete the CAPTCHA verification.");
      setLoading(false);
      return;
    }

    // Call the server-side signup API (handles validation, bcrypt, profile insertion)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        firstName,
        lastName,
        username,
        email,
        password,
        captchaToken,
      }),
    });

    // Safely parse response — guard against empty or non-JSON bodies
    let data: { error?: string; message?: string } = {};
    try {
      data = await res.json();
    } catch {
      // Body was empty or not JSON (e.g. unexpected server crash)
    }

    if (!res.ok) {
      setError(data.error ?? "Unable to create account. Please check your details and try again.");
      resetCaptcha();
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
      setError("Failed to sign up with Google. Please try again.");
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
          {/* Left Side - UI Mockup */}
          <div className="hidden md:flex flex-col items-center justify-center p-12 relative" style={{ backgroundColor: "#ffffff" }}>
            {/* Logo */}
            <Link href="/">
              <motion.div
                className="absolute top-8 left-8 text-2xl font-bold cursor-pointer"
                style={{ color: "#16423c" }}
                whileHover={{ scale: 1.05 }}
              >
                Cremiro
              </motion.div>
            </Link>

            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="absolute bottom-12 left-0 right-0 text-center px-8"
              style={{ marginLeft: "150px" }}
            >
              <p className="text-sm font-medium" style={{ color: "#16423c" }}>
                Join thousands turning YouTube into content
              </p>
              <p className="text-xs text-gray-500 mt-1">Create your account in seconds.</p>
            </motion.div>

            {/* Floating Image */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="relative z-10"
            >
              <motion.div
                animate={{ y: [-8, 0, -8] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <img
                  src="/LoginSignup flat image.png"
                  alt="App preview"
                  style={{ width: "740px", marginLeft: "150px" }}
                />
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
                  Cremiro
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
                  Account created! Please check your email to confirm your address before logging in.
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
                      placeholder="John"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
                      placeholder="Smith"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={30}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
                    placeholder="contentmaster42"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    3–30 characters. Letters, numbers, underscores, dots, hyphens. Must start and end with a letter or number.
                  </p>
                </div>

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
                      minLength={8}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 pr-10 text-sm"
                      placeholder="Min. 8 chars, upper, lower, number, symbol"
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
                    minLength={8}
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

                {/* Cloudflare Turnstile CAPTCHA */}
                <div className="flex justify-center pt-1">
                  <Turnstile
                    ref={captchaRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onError={() => {
                      setCaptchaToken(null);
                      setError("CAPTCHA verification failed. Please try again.");
                    }}
                    onExpire={() => setCaptchaToken(null)}
                    options={{ theme: "light" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !captchaToken}
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

              {/* Social Login - Google */}
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M19.8 10.2273C19.8 9.51819 19.7364 8.83637 19.6182 8.18182H10.2V12.05H15.5818C15.3273 13.3 14.5636 14.3591 13.4182 15.0682V17.5773H16.7364C18.7091 15.8364 19.8 13.2727 19.8 10.2273Z" fill="#4285F4" />
                  <path d="M10.2 20C12.9 20 15.1636 19.1045 16.7364 17.5773L13.4182 15.0682C12.4636 15.6682 11.2364 16.0227 10.2 16.0227C7.59546 16.0227 5.39091 14.2636 4.54091 11.9H1.11365V14.4909C2.67818 17.5909 6.20909 20 10.2 20Z" fill="#34A853" />
                  <path d="M4.54091 11.9C4.32272 11.3 4.2 10.6591 4.2 10C4.2 9.34091 4.32272 8.7 4.54091 8.1V5.50909H1.11365C0.440905 6.85909 0 8.38182 0 10C0 11.6182 0.440905 13.1409 1.11365 14.4909L4.54091 11.9Z" fill="#FBBC05" />
                  <path d="M10.2 3.97727C11.3364 3.97727 12.3591 4.35909 13.1636 5.12727L16.1091 2.18182C15.1591 1.31818 12.9 0 10.2 0C6.20909 0 2.67818 2.40909 1.11365 5.50909L4.54091 8.1C5.39091 5.73636 7.59546 3.97727 10.2 3.97727Z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

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
