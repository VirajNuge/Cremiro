"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      let data: { message?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch { /* empty body */ }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <Link href="/">
          <span
            className="block text-2xl font-bold mb-8 text-center cursor-pointer"
            style={{ color: "#16423c" }}
          >
            Cremiro
          </span>
        </Link>

        {!submitted ? (
          <>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#16423c" }}>
              Forgot password?
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                style={{ backgroundColor: "#fd6333" }}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="text-center"
          >
            {/* Check icon */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: "#fd63331a" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fd6333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "#16423c" }}>
              Check your inbox
            </h2>
            <p className="text-sm text-gray-500 mb-8">
              If an account with <strong>{email}</strong> exists, you&apos;ll receive a password reset link shortly. Check your spam folder if you don&apos;t see it.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 rounded-lg font-semibold text-white text-sm text-center transition-all hover:opacity-90"
              style={{ backgroundColor: "#fd6333" }}
            >
              Back to login
            </Link>
          </motion.div>
        )}

        {!submitted && (
          <p className="text-center mt-6 text-sm text-gray-500">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "#fd6333" }}>
              Log in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
