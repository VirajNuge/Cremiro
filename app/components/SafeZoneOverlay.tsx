"use client";

/**
 * SafeZoneOverlay
 *
 * Renders a transparent SVG overlay on top of the video preview showing
 * platform-specific UI chrome (buttons, bars, captions) so creators can
 * see which areas are obscured before exporting.
 *
 * Designed to sit absolutely inside the video container:
 *   position: absolute, inset: 0, pointerEvents: none, zIndex: 20
 */

export type SafeZonePlatform = "tiktok" | "reels" | "shorts";

interface SafeZoneOverlayProps {
  platform: SafeZonePlatform;
  /** Extra className forwarded to the root <svg> */
  className?: string;
}

export default function SafeZoneOverlay({ platform, className = "" }: SafeZoneOverlayProps) {
  // All coordinates are expressed as percentages of the viewport (0–100)
  // so the overlay scales with any container size.
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${platform} safe zone overlay`}
      className={`absolute inset-0 w-full h-full pointer-events-none z-20 ${className}`}
    >
      {platform === "tiktok" && <TikTokChrome />}
      {platform === "reels"  && <ReelsChrome />}
      {platform === "shorts" && <ShortsChrome />}
    </svg>
  );
}

// ─── TikTok Chrome ────────────────────────────────────────────────────────────
//
// Key UI elements (9:16 phone):
//  • Top status bar:        0–5%  height
//  • Bottom nav bar:        92–100% height
//  • Bottom description:    78–92% height (username + caption + hashtags)
//  • Right action buttons:  from ~42% to ~82% height, 82–100% width
//    (like, comment, share, bookmark, profile)
//  • Profile avatar:        6–11% height, 82–100% width

function TikTokChrome() {
  const shade = "rgba(0,0,0,0.25)";
  const labelStyle: React.CSSProperties = {
    fontSize: "2.2px",
    fill: "rgba(255,255,255,0.7)",
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
  };

  return (
    <g>
      {/* Top status bar */}
      <rect x="0" y="0" width="100" height="5" fill={shade} />
      <text x="50" y="3.5" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.8px" }}>
        Status Bar
      </text>

      {/* Bottom nav bar */}
      <rect x="0" y="92" width="100" height="8" fill={shade} />
      <text x="50" y="96.5" textAnchor="middle" style={labelStyle}>
        Nav Bar
      </text>

      {/* Bottom description area (username, caption, song info) */}
      <rect x="0" y="75" width="78" height="17" fill={shade} />
      <text x="2" y="79" style={labelStyle}>@username</text>
      <text x="2" y="82.5" style={{ ...labelStyle, fontSize: "1.8px" }}>Caption and hashtags here…</text>
      <text x="2" y="87" style={{ ...labelStyle, fontSize: "1.8px" }}>♬ Original Sound</text>

      {/* Right action column */}
      {/* Profile avatar + follow button */}
      <rect x="82" y="10" width="16" height="12" fill={shade} />
      <text x="90" y="16.5" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        Avatar
      </text>

      {/* Like button */}
      <rect x="82" y="42" width="16" height="8" fill={shade} />
      <text x="90" y="46.8" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        ♥ Like
      </text>

      {/* Comment button */}
      <rect x="82" y="52" width="16" height="8" fill={shade} />
      <text x="90" y="56.8" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        💬 Cmnt
      </text>

      {/* Share button */}
      <rect x="82" y="62" width="16" height="8" fill={shade} />
      <text x="90" y="66.8" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        ↗ Share
      </text>

      {/* Bookmark button */}
      <rect x="82" y="72" width="16" height="7" fill={shade} />
      <text x="90" y="76.2" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        🔖 Save
      </text>

      {/* Safe-zone dashed border */}
      <rect
        x="0" y="5" width="82" height="70"
        fill="none"
        stroke="rgba(253,99,51,0.6)"
        strokeWidth="0.4"
        strokeDasharray="2 1.5"
      />
      <text x="1" y="9" style={{ ...labelStyle, fill: "rgba(253,99,51,0.9)", fontSize: "1.6px" }}>
        SAFE ZONE
      </text>
    </g>
  );
}

// ─── Instagram Reels Chrome ───────────────────────────────────────────────────
//
// Key UI elements:
//  • Top bar (back + title + …): 0–7% height
//  • Bottom gradient + info:      74–92% height (username, caption, audio)
//  • Bottom nav bar:              92–100% height
//  • Right actions (like, comment, share, …): 58–92% height, 82–100% width

function ReelsChrome() {
  const shade = "rgba(0,0,0,0.25)";
  const labelStyle: React.CSSProperties = {
    fontSize: "2.2px",
    fill: "rgba(255,255,255,0.7)",
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
  };

  return (
    <g>
      {/* Top navigation bar */}
      <rect x="0" y="0" width="100" height="7" fill={shade} />
      <text x="50" y="4.5" textAnchor="middle" style={labelStyle}>
        ← Reels   ···
      </text>

      {/* Bottom gradient info area */}
      <rect x="0" y="74" width="82" height="18" fill={shade} />
      <text x="2" y="78" style={labelStyle}>@username</text>
      <text x="2" y="82" style={{ ...labelStyle, fontSize: "1.8px" }}>Caption text and more…</text>
      <text x="2" y="86" style={{ ...labelStyle, fontSize: "1.8px" }}>♫ Audio name</text>
      <text x="2" y="90" style={{ ...labelStyle, fontSize: "1.8px" }}>[ Like  Comment  Share  Save ]</text>

      {/* Bottom nav bar */}
      <rect x="0" y="92" width="100" height="8" fill={shade} />
      <text x="50" y="96.5" textAnchor="middle" style={labelStyle}>
        Nav Bar
      </text>

      {/* Right action column */}
      <rect x="82" y="58" width="16" height="34" fill={shade} />
      <text x="90" y="63" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        ♥
      </text>
      <text x="90" y="68" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        💬
      </text>
      <text x="90" y="73" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        ↗
      </text>
      <text x="90" y="78" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        ···
      </text>

      {/* Safe-zone dashed border */}
      <rect
        x="0" y="7" width="82" height="67"
        fill="none"
        stroke="rgba(253,99,51,0.6)"
        strokeWidth="0.4"
        strokeDasharray="2 1.5"
      />
      <text x="1" y="11" style={{ ...labelStyle, fill: "rgba(253,99,51,0.9)", fontSize: "1.6px" }}>
        SAFE ZONE
      </text>
    </g>
  );
}

// ─── YouTube Shorts Chrome ────────────────────────────────────────────────────
//
// Key UI elements:
//  • Top progress bar + status:  0–5% height
//  • Bottom info bar:            80–92% height (title, channel, subscribe)
//  • Bottom nav bar:             92–100% height
//  • Right actions:              42–80% height, 82–100% width
//    (like, dislike, comment, share, remix)

function ShortsChrome() {
  const shade = "rgba(0,0,0,0.25)";
  const labelStyle: React.CSSProperties = {
    fontSize: "2.2px",
    fill: "rgba(255,255,255,0.7)",
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
  };

  return (
    <g>
      {/* Top progress + status bar */}
      <rect x="0" y="0" width="100" height="5" fill={shade} />
      <rect x="2" y="1.5" width="55" height="1" fill="rgba(255,255,255,0.4)" rx="0.5" />
      <rect x="2" y="1.5" width="20" height="1" fill="rgba(255,255,255,0.8)" rx="0.5" />
      <text x="68" y="3.5" style={{ ...labelStyle, fontSize: "1.6px" }}>
        ✕
      </text>

      {/* Bottom info bar (title, channel, subscribe) */}
      <rect x="0" y="80" width="82" height="12" fill={shade} />
      <text x="2" y="84" style={labelStyle}>Video Title</text>
      <text x="2" y="88" style={{ ...labelStyle, fontSize: "1.8px" }}>Channel Name  Subscribe</text>

      {/* Bottom nav bar */}
      <rect x="0" y="92" width="100" height="8" fill={shade} />
      <text x="50" y="96.5" textAnchor="middle" style={labelStyle}>
        Nav Bar
      </text>

      {/* Right action column */}
      {/* Like */}
      <rect x="82" y="42" width="16" height="8" fill={shade} />
      <text x="90" y="46.8" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        👍 Like
      </text>

      {/* Dislike */}
      <rect x="82" y="52" width="16" height="8" fill={shade} />
      <text x="90" y="56.8" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        👎 Dislike
      </text>

      {/* Comment */}
      <rect x="82" y="62" width="16" height="8" fill={shade} />
      <text x="90" y="66.8" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        💬 Cmnt
      </text>

      {/* Share */}
      <rect x="82" y="72" width="16" height="8" fill={shade} />
      <text x="90" y="76.8" textAnchor="middle" style={{ ...labelStyle, fontSize: "1.6px" }}>
        ↗ Share
      </text>

      {/* Safe-zone dashed border */}
      <rect
        x="0" y="5" width="82" height="75"
        fill="none"
        stroke="rgba(253,99,51,0.6)"
        strokeWidth="0.4"
        strokeDasharray="2 1.5"
      />
      <text x="1" y="9" style={{ ...labelStyle, fill: "rgba(253,99,51,0.9)", fontSize: "1.6px" }}>
        SAFE ZONE
      </text>
    </g>
  );
}
