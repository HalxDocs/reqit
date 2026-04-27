import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0D0D0D",
        surface: "#141414",
        card: "#1A1A1A",
        cardHover: "#222222",
        border: "#2A2A2A",
        violet: {
          DEFAULT: "#6C63FF",
          hover: "#7C73FF",
        },
        teal: "#00D4AA",
        danger: "#FF6B6B",
        warn: "#FFB347",
        text: "#F0F0F0",
        subtext: "#888888",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        '11': ['11px', '16px'],
        '12': ['12px', '18px'],
        '13': ['13px', '20px'],
        '14': ['14px', '20px'],
        '16': ['16px', '24px'],
        '20': ['20px', '28px'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '24px',
        '6': '32px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      ringColor: {
        DEFAULT: '#6C63FF',
      },
    },
  },
  plugins: [],
};

export default config;
