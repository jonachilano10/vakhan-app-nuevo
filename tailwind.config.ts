import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "vakhan-black": "#1C1C1E",
        "vakhan-red": "#CC1E1E",
        "vakhan-dark-gray": "#2C2C2E",
        "vakhan-light-gray": "#3A3A3C",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontWeight: {
        bold: "600",
      },
      borderRadius: {
        button: "28px",
        card: "24px",
        input: "6px",
      },
      letterSpacing: {
        label: "0.025em",
      },
    },
  },
  plugins: [],
};

export default config;
