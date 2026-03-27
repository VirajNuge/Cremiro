"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl font-bold"
              style={{ color: "#16423c" }}
            >
              Cremiro
            </motion.div>
            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="px-6 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "#fd6333" }}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-6 py-2 rounded-lg font-medium text-black hover:bg-gray-50 transition-all"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-6 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: "#fd6333" }}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <h1
              className="text-6xl sm:text-7xl font-bold mb-6 leading-tight"
              style={{ color: "#16423c" }}
            >
              Transform YouTube
              <br />
              into Content
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
              Convert your favorite YouTube videos into valuable insights,
              summaries, and content pieces with ease.
            </p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex gap-4 justify-center"
            >
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="px-8 py-4 rounded-lg font-semibold text-white text-lg transition-all hover:opacity-90 hover:scale-105"
                style={{ backgroundColor: "#fd6333" }}
              >
                Get Started
              </Link>
              <button
                className="px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:bg-gray-50 border-2"
                style={{ borderColor: "#16423c", color: "#16423c" }}
              >
                Learn More
              </button>
            </motion.div>
          </motion.div>

          {/* Simple illustration placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-20 w-full max-w-4xl"
          >
            <div className="bg-gray-50 rounded-2xl p-12 border border-gray-100">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div
                    className="w-12 h-12 rounded-full mb-4"
                    style={{ backgroundColor: "#fd6333" }}
                  ></div>
                  <h3
                    className="font-semibold mb-2"
                    style={{ color: "#16423c" }}
                  >
                    Extract
                  </h3>
                  <p className="text-sm text-gray-600">
                    Pull content from any YouTube video
                  </p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div
                    className="w-12 h-12 rounded-full mb-4"
                    style={{ backgroundColor: "#fd6333" }}
                  ></div>
                  <h3
                    className="font-semibold mb-2"
                    style={{ color: "#16423c" }}
                  >
                    Transform
                  </h3>
                  <p className="text-sm text-gray-600">
                    Convert into structured content
                  </p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div
                    className="w-12 h-12 rounded-full mb-4"
                    style={{ backgroundColor: "#fd6333" }}
                  ></div>
                  <h3
                    className="font-semibold mb-2"
                    style={{ color: "#16423c" }}
                  >
                    Export
                  </h3>
                  <p className="text-sm text-gray-600">
                    Use anywhere you need it
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
