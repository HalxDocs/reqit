import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        card: "var(--color-card)",
        cardHover: "var(--color-card-hover)",
        border: "var(--color-border)",
        cyan: {
          DEFAULT: "var(--color-cyan)",
          hover: "var(--color-cyan-hover)",
          dim: "var(--color-cyan-dim)",
        },
        get: "var(--color-get)",
        post: "var(--color-post)",
        put: "var(--color-put)",
        patch: "var(--color-patch)",
        del: "var(--color-del)",
        danger: "var(--color-danger)",
        warn: "var(--color-warn)",
        success: "var(--color-success)",
        text: "var(--color-text)",
        subtext: "var(--color-subtext)",
        tertiary: "var(--color-tertiary)",
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
        DEFAULT: 'var(--color-cyan)',
      },
    },
  },
  plugins: [],
};

export default config;
