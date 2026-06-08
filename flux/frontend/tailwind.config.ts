import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface layers
        bg: "#0F0F11",
        surface: "#141416",
        card: "#1A1A1D",
        cardHover: "#202024",
        border: "#26262C",
        // Plasma cyan accent
        cyan: {
          DEFAULT: "#0891B2",
          hover: "#06B6D4",
          dim: "#0E7490",
        },
        // Method colors
        get: "#5B9CF6",
        post: "#0891B2",
        put: "#F59E0B",
        patch: "#C084FC",
        del: "#F87171",
        // Status
        danger: "#F87171",
        warn: "#E8A44A",
        success: "#3DFAAF",
        // Text hierarchy
        text: "#F2F2F4",
        subtext: "#A0A0B0",
        tertiary: "#606072",
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '11': ['11px', '16px'],
        '12': ['12px', '18px'],
        '13': ['13px', '20px'],
        '14': ['14px', '20px'],
        '15': ['15px', '22px'],
        '16': ['16px', '24px'],
        '18': ['18px', '26px'],
        '20': ['20px', '28px'],
        '22': ['22px', '30px'],
        '28': ['28px', '34px'],
        '36': ['36px', '42px'],
        '48': ['48px', '54px'],
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
        DEFAULT: '#0891B2',
      },
    },
  },
  plugins: [],
};

export default config;
