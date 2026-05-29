import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/types/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: "var(--lab-bg)",
          panel: "var(--lab-panel)",
          border: "var(--lab-border)",
          text: "var(--lab-text)",
          muted: "var(--lab-muted)",
          accent: "var(--lab-accent)",
          terra: "var(--terra)",
          "terra-2": "var(--terra-2)",
          ok: "var(--ok)",
          anomaly: "var(--anomaly)",
          pending: "var(--pending)",
          cream: "var(--cream)",
          "warm-gray": "var(--warm-gray)",
        },
      },
      fontFamily: {
        sans: ["var(--font-syne)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
