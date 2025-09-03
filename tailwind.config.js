/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"], // Angular templates + standalone components
  darkMode: "class",
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
    },
  },
  plugins: [],
  corePlugins: { preflight: true }, // keep your current styles; avoids Tailwind reset
};