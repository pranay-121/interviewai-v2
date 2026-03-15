/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe",
          400: "#818cf8", 500: "#6366f1", 600: "#4f46e5",
          700: "#4338ca", 800: "#3730a3", 900: "#312e81",
        },
        dark: {
          50: "#f8fafc", 100: "#f1f5f9",
          800: "#1e293b", 850: "#172033",
          900: "#0f172a", 950: "#080d1a",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "glow": "glow 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "bounce-dot": "bounceDot 1.2s infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(20px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        glow: { "0%,100%": { boxShadow: "0 0 20px rgba(99,102,241,0.15)" }, "50%": { boxShadow: "0 0 40px rgba(99,102,241,0.4)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        bounceDot: { "0%,60%,100%": { transform: "translateY(0)", opacity: "0.4" }, "30%": { transform: "translateY(-6px)", opacity: "1" } },
      },
    },
  },
  plugins: [],
};
