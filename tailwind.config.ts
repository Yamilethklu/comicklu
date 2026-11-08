import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16132b",
        paper: "#eef1f8",
        pop: "#ff3d81",
        sun: "#ffd23f",
        zap: "#17c3e6",
        mint: "#3ddc97",
        grape: "#7c4dff",
      },
      fontFamily: {
        display: ["Bangers", "Impact", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
      boxShadow: {
        hard: "4px 4px 0 0 #16132b",
        "hard-sm": "2px 2px 0 0 #16132b",
        "hard-lg": "8px 8px 0 0 #16132b",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0) rotate(var(--r,0deg))" }, "50%": { transform: "translateY(-10px) rotate(var(--r,0deg))" } },
        wiggle: { "0%,100%": { transform: "rotate(-4deg)" }, "50%": { transform: "rotate(4deg)" } },
        pop: { "0%": { opacity: "0", transform: "scale(.85) translateY(12px)" }, "100%": { opacity: "1", transform: "scale(1) translateY(0)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        shine: { "0%": { transform: "translateX(-120%) skewX(-20deg)" }, "100%": { transform: "translateX(320%) skewX(-20deg)" } },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        "float-slow": "float 6s ease-in-out infinite",
        wiggle: "wiggle 2.4s ease-in-out infinite",
        pop: "pop .45s cubic-bezier(.2,.9,.3,1.2) both",
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
