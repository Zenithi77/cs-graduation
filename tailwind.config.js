/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"]
      },
      colors: {
        cream: "#F7F1E6",
        ink: "#1B1B1B",
        gold: "#C8A24B",
        wine: "#7A1F2B"
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        shine: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        floaty: "floaty 4s ease-in-out infinite",
        shine: "shine 6s linear infinite"
      }
    }
  },
  plugins: []
};
