/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#09090B',
          900: '#0F1014',
          850: '#14151B',
          800: '#1B1C24',
          700: '#27272A',
        },
        accent: {
          DEFAULT: '#8B5CF6',
          hover: '#7C3AED',
          subtle: '#21183B',
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '14px',
      },
    },
  },
  plugins: [],
};
