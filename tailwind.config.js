/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Claude-inspired warm palette: ink on paper
        primary: '#c96442',        // Claude orange — main CTA
        'primary-dim': '#a85230',  // CTA hover / active
        accent: '#b67a3a',         // 淡琥珀 — 次要強調
        surface: '#ffffff',        // 卡片前景
        base: '#faf9f5',           // 頁面底（暖米白）
        card: '#f4f1e9',           // 次層卡片（略深米）
        correct: '#5b7f4f',        // 溫和綠
        wrong: '#b54545',          // 赤陶紅
        ink: '#1f1d18',            // 主文字（更深、接近墨色）
        'ink-soft': '#4d473c',     // 次要文字（加深）
        'ink-faint': '#766f5f',    // 提示文字（加深、不再太淺）
        border: '#d8d1bf',         // 邊線
        'border-strong': '#b9b29f',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans TC"', 'sans-serif'],
        serif: ['"Source Serif 4"', '"Noto Serif TC"', 'Georgia', 'serif'],
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22,1,0.36,1) forwards',
      }
    },
  },
  plugins: [],
}
