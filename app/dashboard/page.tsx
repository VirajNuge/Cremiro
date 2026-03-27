"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl font-bold cursor-pointer"
              style={{ color: "#16423c" }}
              onClick={() => router.push("/")}
            >
              YT to Content
            </motion.div>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleSignOut}
              className="px-6 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: "#fd6333" }}
            >
              Sign Out
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-4" style={{ color: "#16423c" }}>
              Welcome{user.full_name ? `, ${user.full_name}` : ""}!
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              {user.username && (
                <>
                  Signed in as{" "}
                  <span className="font-semibold" style={{ color: "#fd6333" }}>
                    @{user.username}
                  </span>
                </>
              )}
              {!user.username && (
                <>
                  Signed in as{" "}
                  <span className="font-semibold" style={{ color: "#fd6333" }}>
                    {user.email}
                  </span>
                </>
              )}
            </p>
            <p className="text-gray-500">
              This is a placeholder dashboard. More features coming soon!
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
            >
              <div
                className="w-12 h-12 rounded-full mb-4 flex items-center justify-center text-2xl"
                style={{ backgroundColor: "#fd6333" }}
              >
                📹
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: "#16423c" }}>
                0
              </h3>
              <p className="text-gray-600">Videos Processed</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
            >
              <div
                className="w-12 h-12 rounded-full mb-4 flex items-center justify-center text-2xl"
                style={{ backgroundColor: "#90EE90" }}
              >
                📝
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: "#16423c" }}>
                0
              </h3>
              <p className="text-gray-600">Content Generated</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
            >
              <div
                className="w-12 h-12 rounded-full mb-4 flex items-center justify-center text-2xl"
                style={{ backgroundColor: "#ffd700" }}
              >
                ⭐
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: "#16423c" }}>
                0
              </h3>
              <p className="text-gray-600">Saved Items</p>
            </motion.div>
          </div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border border-gray-200"
          >
            <h2 className="text-3xl font-bold mb-4" style={{ color: "#16423c" }}>
              Ready to Get Started?
            </h2>
            <p className="text-gray-600 mb-6">
              Start transforming YouTube videos into valuable content. Paste a
              YouTube URL and let the magic happen!
            </p>
            <button
              className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: "#fd6333" }}
            >
              Start Converting
            </button>
          </motion.div>

          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 bg-white rounded-2xl p-6 border border-gray-200"
          >
            <h3 className="text-xl font-semibold mb-4" style={{ color: "#16423c" }}>
              Account Information
            </h3>
            <div className="space-y-2 text-gray-600">
              {user.full_name && (
                <p>
                  <span className="font-medium">Name:</span> {user.full_name}
                </p>
              )}
              {user.username && (
                <p>
                  <span className="font-medium">Username:</span> @{user.username}
                </p>
              )}
              <p>
                <span className="font-medium">Email:</span> {user.email}
              </p>
              <p>
                <span className="font-medium">User ID:</span> {user.id}
              </p>
              <p>
                <span className="font-medium">Member since:</span>{" "}
                {new Date(user.created_at!).toLocaleDateString()}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
