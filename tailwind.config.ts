import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
        extend: {
                fontFamily: {
                    sans: ['var(--font-cinzel)', 'Cinzel', 'serif'],
                },
                colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        },
                        /* =============================================
                           Brand Gold Palette — based on #D4A73A
                           Overrides Tailwind amber to match brand gold
                           ============================================= */
                        amber: {
                                50:  '#FDF8EC',
                                100: '#FAF0CC',
                                200: '#F2DF9E',
                                300: '#EACD6F',
                                400: '#E0B94A',
                                500: '#D4A73A',
                                600: '#B8942F',
                                700: '#9A7B26',
                                800: '#7C631D',
                                900: '#5E4A14',
                                950: '#3F310D',
                        },
                        gold: {
                                50:  '#FDF8EC',
                                100: '#FAF0CC',
                                200: '#F2DF9E',
                                300: '#EACD6F',
                                400: '#E0B94A',
                                500: '#D4A73A',
                                600: '#B8942F',
                                700: '#9A7B26',
                                800: '#7C631D',
                                900: '#5E4A14',
                                950: '#3F310D',
                        },
                        charcoal: {
                                50:  '#E8E9EC',
                                100: '#C5C7CD',
                                200: '#9EA1AA',
                                300: '#767A87',
                                400: '#585D6C',
                                500: '#3A3F50',
                                600: '#2D3242',
                                700: '#1D2437',
                                800: '#161B26',
                                900: '#0F141D',
                                950: '#0A0D13',
                        },
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                }
        }
  },
  plugins: [tailwindcssAnimate],
};
export default config;
