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
      },
      fontFamily: {
        display: ["Bangers", "Impact", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
      boxShadow: {
        hard: "4px 4px 0 0 #16132b",
        "hard-sm": "2px 2px 0 0 #16132b",
      },
    },
  },
  plugins: [],
} satisfies Config;
