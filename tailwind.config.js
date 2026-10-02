/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0b16",
        panel: "#15152a",
        panel2: "#1e1e3a",
        brand: {
          DEFAULT: "#7c3aed",
          soft: "#a78bfa",
          deep: "#5b21b6"
        },
        good: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
        cyan: "#22d3ee"
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(124,58,237,0.6)"
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.7)", opacity: "0" },
          "70%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)" }
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        }
      },
      animation: {
        "pop-in": "pop-in 0.35s ease-out",
        float: "float 3s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
