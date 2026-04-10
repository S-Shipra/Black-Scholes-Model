import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './component/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        qt: {
          bg:          '#07090F',
          bar:         '#090D18',
          card:        '#0E1320',
          input:       '#111827',
          cyan:        '#00E5B4',
          amber:       '#F5A623',
          red:         '#FF4560',
          text:        '#DFE8F5',
          sub:         '#7A90A8',
          muted:       '#364A62',
          border:      '#0E1A28',
          borderMid:   '#162030',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config