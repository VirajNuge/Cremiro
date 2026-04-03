"use client";

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";

export default function Home() {
  const { user } = useAuth();
  
  // Interactive Background Mouse Tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  const interactiveMask = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, black, transparent)`;
  const interactiveBg = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(253, 99, 51, 0.08), transparent)`;

  return (
    <div className="min-h-screen bg-[#fafbfc] font-sans relative overflow-hidden flex flex-col items-center" onMouseMove={handleMouseMove}>
      
      {/* Interactive Plus (+) Pattern Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Static Faint Grid */}
            <pattern id="plusPatternStatic" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M25 20 L25 30 M20 25 L30 25" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            </pattern>
            {/* Highlighted Orange Grid for Interactive Reveal */}
            <pattern id="plusPatternInteractive" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M25 20 L25 30 M20 25 L30 25" stroke="#fd6333" strokeOpacity="0.4" strokeWidth="1.8" strokeLinecap="round" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#plusPatternStatic)" />
        </svg>

        {/* Glow overlay that follows mouse */}
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          style={{ background: interactiveBg, WebkitMaskImage: interactiveMask, maskImage: interactiveMask }}
        >
          <svg width="100%" height="100%">
            <rect width="100%" height="100%" fill="url(#plusPatternInteractive)" />
          </svg>
        </motion.div>
      </div>

      {/* Floating Navbar (Manageko Style) */}
      <nav className="relative z-50 w-full max-w-5xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-3 py-2 flex items-center justify-between pointer-events-auto">
          {/* Logo Section */}
          <div className="flex items-center gap-3 ml-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: "#16423c" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 22h20L12 2z"/>
              </svg>
            </div>
            <span className="text-[18px] tracking-tight font-bold" style={{ color: "#16423c" }}>Cremiro.</span>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors">Features</Link>
            <Link href="/use-case" className="text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors">Use Case</Link>
            <Link href="/pricing" className="text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/blogs" className="text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors">Blogs</Link>
          </div>

          {/* Action */}
          <div className="flex items-center gap-2">
            {user ? (
               <Link href="/dashboard" className="rounded-lg px-6 py-2.5 font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg" style={{ backgroundColor: "#16423c" }}>
                 Dashboard
               </Link>
            ) : (
               <>
                 <Link href="/login" className="rounded-lg px-5 py-2 text-[14px] font-semibold text-slate-800 transition-all hover:bg-slate-50 border border-slate-200">
                   Login
                 </Link>
                 <Link href="/signup" className="rounded-lg px-5 py-2 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90" style={{ backgroundColor: "#16423c" }}>
                   Get Started
                 </Link>
               </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 w-full flex flex-col items-center justify-center pt-24 pb-32 px-4 flex-1 pointer-events-auto">
        
        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="inline-flex flex-row items-center bg-white border border-slate-100 shadow-sm rounded-full pr-3 pl-1 py-1 gap-2 cursor-pointer hover:shadow-md transition-shadow">
            <span className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full shadow-sm" style={{ background: "linear-gradient(135deg, #fd6333, #ea532a)" }}>
              ✨ Automated
            </span>
            <span className="text-[12px] font-bold text-slate-700">
              Cross-Platform Publishing <span className="text-slate-400 font-normal ml-1">›</span>
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center font-bold tracking-tight text-6xl sm:text-7xl mb-6 leading-[1.05]"
          style={{ color: "#16423c", letterSpacing: "-1.5px" }}
        >
          Turn One YouTube Video<br />into a Week of Content
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-[17px] text-slate-500 max-w-2xl mb-10 leading-relaxed font-medium"
        >
          Our AI extracts semantic hooks and transforms your long-form videos<br className="hidden sm:block" />
          into viral Shorts, LinkedIn posts, and X threads in seconds.
        </motion.p>

        {/* Action Button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className=" flex flex-col items-center">
          <Link 
            href="/signup" 
            className="rounded-xl px-10 py-3.5 font-bold text-white text-lg transition-transform hover:scale-105 active:scale-95 shadow-[0_8px_20px_rgba(253,99,51,0.25)]"
            style={{ backgroundColor: "#fd6333" }}
          >
            Get Started for Free
          </Link>
          <span className="text-[13px] font-medium text-slate-400 mt-4">
            No credit card required.
          </span>
        </motion.div>

      </main>

      {/* Floating Decorator Cards wrapper to position absolute elements relative to screen */}
      <div className="absolute inset-0 z-20 pointer-events-none max-w-[1400px] mx-auto w-full h-full xl:block hidden">
        
        {/* --- Card 1: Content Extraction (Top Left) --- */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, x: -20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.4 }}
          className="absolute top-[20%] left-[2%] bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-slate-50 w-64 animate-float"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[13px] font-bold text-slate-800 mb-2">Semantic Extraction</div>
              <div className="flex -space-x-1">
                <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white"></div>
                <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white"></div>
                <div className="w-6 h-6 rounded-full bg-slate-400 border-2 border-white"></div>
                <div className="w-6 h-6 rounded-full bg-[#16423c] border-2 border-white"></div>
              </div>
            </div>
            <div className="text-xl font-black" style={{ color: "#16423c" }}>100x</div>
          </div>
          <div className="h-px w-full bg-slate-100 mb-4"></div>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#fd6333" }}></div> Hooks
              </span>
              <span className="text-lg font-bold text-slate-800 mt-1">10 <span className="text-[10px] text-slate-400 font-normal">Extracted</span></span>
            </div>
            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Clips
              </span>
              <span className="text-lg font-bold text-slate-800 mt-1">15 <span className="text-[10px] text-slate-400 font-normal">Generated</span></span>
            </div>
          </div>
        </motion.div>

        {/* --- Card 2: Cross Platform Export (Top Right) --- */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
          className="absolute top-[22%] right-[2%] bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-slate-50 w-[340px] animate-float-slow"
        >
          <div className="text-[15px] font-bold text-slate-800 mb-1">Cross-Platform Distribution</div>
          <div className="text-[11px] text-slate-400 mb-6">
            Export optimized formats natively to all platforms
          </div>
          <div className="flex justify-between items-center px-1">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full border border-dashed border-[#fd6333] bg-[#fd6333]/10 flex items-center justify-center text-[#fd6333] font-bold">+</div>
              <span className="text-[9px] text-[#fd6333] font-bold">Auto Post</span>
            </div>
            <div className="flex flex-col items-center gap-1">
               <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                 <svg className="w-4 h-4 text-[#16423c]" viewBox="0 0 24 24" fill="currentColor"><path d="M22.46,6C21.69,6.35 20.86,6.58 20,6.69C20.88,6.16 21.56,5.32 21.88,4.31C21.05,4.81 20.13,5.16 19.16,5.36C18.37,4.5 17.26,4 16,4C13.65,4 11.73,5.92 11.73,8.29C11.73,8.63 11.77,8.96 11.84,9.27C8.28,9.09 5.11,7.38 3,4.79C2.63,5.42 2.42,6.16 2.42,6.94C2.42,8.43 3.17,9.75 4.33,10.5C3.62,10.5 2.96,10.3 2.38,10C2.38,10 2.38,10 2.38,10.03C2.38,12.11 3.86,13.85 5.82,14.24C5.46,14.34 5.08,14.39 4.69,14.39C4.42,14.39 4.15,14.36 3.89,14.31C4.43,16.01 6.01,17.26 7.89,17.29C6.43,18.45 4.58,19.13 2.56,19.13C2.22,19.13 1.88,19.11 1.54,19.07C3.44,20.29 5.7,21 8.12,21C16.01,21 20.33,14.46 20.33,8.79C20.33,8.6 20.33,8.42 20.32,8.23C21.16,7.63 21.88,6.87 22.46,6Z" /></svg>
               </div>
               <span className="text-[9px] text-slate-600 font-medium tracking-tight">Twitter</span>
            </div>
            <div className="flex flex-col items-center gap-1">
               <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                 <svg className="w-4 h-4 text-[#16423c]" viewBox="0 0 24 24" fill="currentColor"><path d="M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3H19M18.5,18.5V13.2A3.26,3.26 0 0,0 15.24,9.94C14.39,9.94 13.4,10.46 12.92,11.24V10.13H10.13V18.5H12.92V13.57C12.92,12.8 13.54,12.17 14.31,12.17A1.4,1.4 0 0,1 15.71,13.57V18.5H18.5M6.88,8.56A1.68,1.68 0 0,0 8.56,6.88C8.56,5.95 7.81,5.19 6.88,5.19A1.69,1.69 0 0,0 5.19,6.88C5.19,7.81 5.95,8.56 6.88,8.56M8.27,18.5V10.13H5.5V18.5H8.27Z" /></svg>
               </div>
               <span className="text-[9px] text-slate-600 font-medium tracking-tight">LinkedIn</span>
            </div>
            <div className="flex flex-col items-center gap-1">
               <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                 <svg className="w-4 h-4 text-[#16423c]" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z" /></svg>
               </div>
               <span className="text-[9px] text-slate-600 font-medium tracking-tight">Instagram</span>
            </div>
            <div className="flex flex-col items-center gap-1">
               <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                 <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.36 1.38V7.3s-1.88.09-3.24-1.48z"/></svg>
               </div>
               <span className="text-[9px] text-slate-600 font-medium tracking-tight">TikTok</span>
            </div>
          </div>
        </motion.div>

        {/* --- Card 3: Traffic Generation (Bottom Left) --- */}
        <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
           className="absolute bottom-[10%] left-[6%] bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-slate-50 w-[360px] animate-float-alt"
        >
          <div className="text-[12px] font-medium text-slate-400 mb-1">Total Cross-Platform Views</div>
          <div className="flex justify-between items-baseline mb-6">
            <div className="text-[28px] font-black" style={{ color: "#16423c" }}>1,250,056</div>
            <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">+32.55% ↗</div>
          </div>
          
          <div className="flex justify-between bg-white border border-slate-100 rounded-full p-1.5 mb-6">
             <div className="text-[11px] font-medium text-slate-500 flex-1 text-center py-1">24 hours</div>
             <div className="text-[11px] font-medium text-slate-500 flex-1 text-center py-1">Week</div>
             <div className="text-[11px] font-bold text-white flex-1 text-center py-1 rounded-full shadow-sm" style={{ backgroundColor: "#fd6333" }}>Month</div>
          </div>

          <div className="h-20 w-full relative mt-8">
            <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
              <path d="M0,35 Q10,15 25,25 T50,15 T75,25 T100,20 L100,40 L0,40 Z" fill="#fd6333" fillOpacity="0.1" />
              <path d="M0,35 Q10,15 25,25 T50,15 T75,25 T100,20" fill="none" stroke="#fd6333" strokeWidth="2" strokeLinecap="round" />
              <circle cx="25" cy="25" r="3" fill="white" stroke="#fd6333" strokeWidth="1.5" />
            </svg>
            <div className="absolute top-0 left-[25%] -translate-x-1/2 -mt-7 bg-white shadow-lg border border-slate-100 rounded-xl px-3 py-1.5 z-10 flex flex-col items-center">
              <span className="text-[9px] text-slate-400 flex items-center justify-between w-full mb-0.5">Oct 28 <span className="text-emerald-500 ml-2">+12.55%</span></span>
              <span className="text-sm font-black text-slate-800">45,863</span>
            </div>
            <div className="flex justify-between w-full text-[9px] text-slate-400 mt-2 uppercase font-medium">
               <span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span>
            </div>
          </div>
        </motion.div>

        {/* --- Card 4: Platform Performance (Bottom Right) --- */}
        <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }}
           className="absolute bottom-[12%] right-[6%] bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-slate-50 w-[300px] animate-float"
        >
           <div className="flex justify-between items-center mb-6">
             <div className="text-[14px] font-bold text-slate-800">Growth by Format</div>
             <div className="text-slate-400 tracking-widest leading-none font-bold">...</div>
           </div>
           
           <div className="relative h-32 flex justify-center items-end overflow-hidden mb-6">
              <svg className="w-48 h-48 absolute top-4" viewBox="0 0 100 100">
                {/* Outer Ring */}
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#fd6333" strokeWidth="6" strokeDasharray="125" strokeDashoffset="35" strokeLinecap="round" />
                
                {/* Middle Ring */}
                <path d="M 20 50 A 30 30 0 0 1 80 50" fill="none" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
                <path d="M 20 50 A 30 30 0 0 1 80 50" fill="none" stroke="#16423c" strokeWidth="6" strokeDasharray="94" strokeDashoffset="45" strokeLinecap="round" />
                
                {/* Inner Ring */}
                <path d="M 30 50 A 20 20 0 0 1 70 50" fill="none" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
              </svg>
           </div>

           <div className="flex justify-between px-2 mb-3">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#fd6333" }}></div>
                 <span className="text-[11px] font-bold text-slate-700">Shorts & Reels 45%</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#16423c" }}></div>
                 <span className="text-[11px] font-bold text-slate-700">LinkedIn Posts 35%</span>
              </div>
           </div>
           
           <div className="text-center text-[11px] font-bold text-slate-500">
             <span className="inline-block w-1.5 h-1.5 bg-slate-200 rounded-sm mr-1"></span> Twitter / X Threads 20%
           </div>
        </motion.div>

      </div>
    </div>
  );
}
