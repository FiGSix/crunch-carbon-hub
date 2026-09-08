import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./index.html",
		"./src/**/*.{ts,tsx}",
	],
	safelist: [
		'hover-card',
		'text-crunch-yellow',
		'bg-crunch-yellow',
		'text-crunch-black',
		'bg-crunch-black',
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				'crunch': {
					black: 'hsl(var(--crunch-black))',
					yellow: 'hsl(var(--crunch-yellow))',
				},
				// Legacy support for existing components
				'crunch-black': 'hsl(var(--crunch-black))',
				'crunch-yellow': 'hsl(var(--crunch-yellow))',
				'industry-tint': 'hsl(var(--industry-tint))',
				'carbon-gray': {
					50: 'hsl(var(--muted))',
					100: 'hsl(var(--muted))',
					200: 'hsl(var(--muted))',
					300: 'hsl(var(--muted))',
					400: 'hsl(var(--muted-foreground))',
					500: 'hsl(var(--muted-foreground))',
					600: 'hsl(var(--foreground))',
					700: 'hsl(var(--foreground))',
					800: 'hsl(var(--foreground))',
					900: 'hsl(var(--foreground))',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				/* Milestone: a restrained line draws across the card top, once. */
				'milestone-line': {
					from: { transform: 'scaleX(0)' },
					to: { transform: 'scaleX(1)' }
				},
				/* Audit Ready: a single quiet highlight sweep across the card. */
				'highlight-sweep': {
					from: { transform: 'translateX(-100%)' },
					to: { transform: 'translateX(100%)' }
				},
				/* Partner rail: one duplicated set scrolls by, then loops seamlessly. */
				'partner-rail': {
					from: { transform: 'translateX(0)' },
					to: { transform: 'translateX(-50%)' }
				},
				'partner-rail-reverse': {
					from: { transform: 'translateX(-50%)' },
					to: { transform: 'translateX(0)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'milestone-line': 'milestone-line 0.7s ease-out both',
				'highlight-sweep': 'highlight-sweep 1.1s ease-out both',
				'partner-rail': 'partner-rail 45s linear infinite',
				'partner-rail-reverse': 'partner-rail-reverse 45s linear infinite'
			},

            fontFamily: {
                'sans': ['Inter', 'system-ui', 'sans-serif'],
            },
            transformOrigin: {
              'center-bottom': 'center bottom',
            },
            perspective: {
              '1200': '1200px',
              '2000': '2000px',
            },
            rotate: {
              'x-30': 'rotateX(30deg)',
              'z-12': 'rotateZ(12deg)',
            },
            transform: {
              'gpu': 'translate3d(0, 0, 0)',
            }
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
