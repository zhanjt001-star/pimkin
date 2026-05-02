import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#c45a00",
          dark: "#9f4300",
          pale: "#fff3e8",
          dot: "#efc9ad",
          ink: "#2f241c",
          muted: "#7a6354",
        },
      },
      boxShadow: {
        orange: "0 12px 28px rgba(137, 66, 9, 0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
