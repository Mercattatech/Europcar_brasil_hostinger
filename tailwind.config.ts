import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        europcar: {
          green: "#009900", // Official Europcar Green
          dark: "#006600",
          yellow: "#FFCC00"
        }
      },
    },
  },
  plugins: [],
};
export default config;
