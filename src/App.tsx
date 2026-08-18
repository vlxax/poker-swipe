import { useState } from "react";

const suits: Record<string, string> = {
  "♠": "♠",
  "♣": "♣",
  "♥": "♥",
  "♦": "♦",
};

function PlayingCard({
  rank,
  suit,
  hidden = false,
  className = "",
}: {
  rank: string;
  suit?: string;
  hidden?: boolean;
  className?: string;
}) {
  const isRed = suit === "♥" || suit === "♦";

  return (
    <div
      className={`select-none transition-all duration-300 ${className}`}
      style={{
        width: "92px",
        height: "128px",
        borderRadius: "14px",
        position: "relative",
        fontFamily: "var(--font-display)",
        /* deep 3-layer shadow for volume */
        filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.35)) drop-shadow(0 8px 16px rgba(0,0,0,0.55)) drop-shadow(0 20px 32px rgba(0,0,0,0.4))",
      }}
    >
      {/* Card body */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "14px",
          overflow: "hidden",
          position: "relative",
          backgroundImage: hidden
            ? "linear-gradient(145deg, #1e5c38 0%, #0f2f1c 60%, #091a10 100%)"
            : "linear-gradient(160deg, #ffffff 0%, #f5f5f5 55%, #e8e8e8 100%)",
          border: hidden
            ? "1.5px solid rgba(163,230,53,0.25)"
            : "1.5px solid rgba(255,255,255,0.9)",
        }}
      >
        {/* Top-left glare streak */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "45%",
            backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.22) 0%, transparent 100%)",
            borderRadius: "14px 14px 0 0",
            pointerEvents: "none",
          }}
        />

        {hidden ? (
          /* Hidden card — crosshatch pattern + lime glow center */
          <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Diamond grid */}
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }}
              viewBox="0 0 92 128"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="diag" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                  <path d="M0 12 L12 0 M-3 3 L3 -3 M9 15 L15 9" stroke="#a3e635" strokeWidth="1" fill="none" />
                </pattern>
              </defs>
              <rect width="92" height="128" fill="url(#diag)" />
            </svg>
            {/* Center glow */}
            <div style={{
              width: "48px", height: "48px",
              borderRadius: "50%",
              backgroundImage: "radial-gradient(circle, rgba(163,230,53,0.55) 0%, transparent 70%)",
              filter: "blur(6px)",
            }} />
            <div style={{
              position: "absolute",
              fontSize: "26px",
              fontWeight: 700,
              color: "rgba(163,230,53,0.9)",
              textShadow: "0 0 12px rgba(163,230,53,0.6)",
            }}>?</div>
          </div>
        ) : (
          /* Face card */
          <>
            {/* Top-left corner */}
            <div style={{
              position: "absolute", top: "8px", left: "9px",
              display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1,
              color: isRed ? "#c81e1e" : "#111",
            }}>
              <span style={{ fontSize: "16px", fontWeight: 700 }}>{rank}</span>
              <span style={{ fontSize: "13px", marginTop: "-1px" }}>{suit}</span>
            </div>

            {/* Center suit — large */}
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "42px",
              color: isRed ? "#c81e1e" : "#111",
              textShadow: isRed
                ? "0 1px 3px rgba(200,30,30,0.25)"
                : "0 1px 3px rgba(0,0,0,0.2)",
            }}>
              {suit}
            </div>

            {/* Bottom-right corner (flipped) */}
            <div style={{
              position: "absolute", bottom: "8px", right: "9px",
              display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1,
              transform: "rotate(180deg)",
              color: isRed ? "#c81e1e" : "#111",
            }}>
              <span style={{ fontSize: "16px", fontWeight: 700 }}>{rank}</span>
              <span style={{ fontSize: "13px", marginTop: "-1px" }}>{suit}</span>
            </div>

            {/* Subtle red/dark tint on edges for depth */}
            <div style={{
              position: "absolute", inset: 0,
              borderRadius: "13px",
              backgroundImage: "radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,0.07) 100%)",
              pointerEvents: "none",
            }} />
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="size-full flex items-center justify-center p-4"
      style={{
        background: "#050505",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Main card */}
      <div
        className="relative w-full max-w-[420px] rounded-3xl overflow-hidden cursor-pointer"
        style={{ aspectRatio: "420/270" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 animate-gradient"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #071510 0%, #0c2218 25%, #061210 50%, #112b1c 75%, #071510 100%)",
            backgroundSize: "400% 400%",
          }}
        />

        {/* Ambient glow orb */}
        <div
          className="animate-glow absolute rounded-full"
          style={{
            width: "280px",
            height: "280px",
            top: "-80px",
            right: "-60px",
            background:
              "radial-gradient(circle, rgba(163,230,53,0.18) 0%, rgba(101,163,13,0.08) 50%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />

        {/* Secondary glow — bottom left */}
        <div
          className="absolute rounded-full"
          style={{
            width: "200px",
            height: "200px",
            bottom: "-80px",
            left: "-40px",
            background:
              "radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-6">
          {/* Top label */}
          <div>
            <div
              className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-3"
              style={{ color: "rgba(163,230,53,0.7)", fontFamily: "var(--font-body)" }}
            >
              Раздача дня
            </div>

            <div style={{ fontFamily: "var(--font-display)" }}>
              <div
                className="text-5xl font-bold leading-none tracking-tight"
                style={{ color: "#ffffff" }}
              >
                ОДНА
              </div>
              <div
                className="text-5xl font-bold leading-none tracking-tight text-shimmer"
                style={{ fontFamily: "var(--font-display)" }}
              >
                РУКА.
              </div>
            </div>

            <p
              className="mt-4 text-[14px] leading-relaxed max-w-[220px]"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Один сложный спот: решение, размер и логика.
            </p>
          </div>

          {/* Arrow button */}
          <div className="flex items-end justify-between">
            <button
              className="group flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all duration-200"
              style={{
                background: "rgba(163,230,53,0.15)",
                border: "1px solid rgba(163,230,53,0.3)",
                color: "#a3e635",
                fontFamily: "var(--font-body)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(163,230,53,0.25)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(163,230,53,0.15)";
              }}
            >
              Разобрать
              <span className="animate-arrow inline-block">→</span>
            </button>
          </div>
        </div>

        {/* Cards cluster */}
        <div
          className="absolute z-20"
          style={{
            right: "-12px",
            bottom: "16px",
            width: "220px",
            height: "180px",
          }}
        >
          {/* Card 1 – back / left */}
          <div
            className="animate-card-1 absolute transition-all duration-300"
            style={{
              left: "0px",
              bottom: "0px",
              transform: "rotate(-12deg)",
              transformOrigin: "bottom center",
              filter: hovered ? "brightness(1.05)" : "brightness(0.92)",
            }}
          >
            <PlayingCard rank="Q" suit="♠" />
          </div>

          {/* Card 2 – middle */}
          <div
            className="animate-card-2 absolute transition-all duration-300"
            style={{
              left: "58px",
              bottom: "8px",
              transform: "rotate(-3deg)",
              transformOrigin: "bottom center",
              filter: hovered ? "brightness(1.08)" : "brightness(0.97)",
            }}
          >
            <PlayingCard rank="J" suit="♣" />
          </div>

          {/* Card 3 – front / hidden */}
          <div
            className="animate-card-3 absolute transition-all duration-300"
            style={{
              left: "116px",
              bottom: "4px",
              transform: "rotate(8deg)",
              transformOrigin: "bottom center",
            }}
          >
            <PlayingCard rank="?" hidden />
          </div>
        </div>

        {/* Subtle inner border */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            border: "1px solid rgba(163,230,53,0.12)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />
      </div>
    </div>
  );
}
