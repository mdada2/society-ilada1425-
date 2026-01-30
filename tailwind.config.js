/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'SF Pro Display', 'DVOT SurekhMR', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'DVOT SurekhMR', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
            },
            colors: {
                // iOS System Colors
                ios: {
                    blue: '#007AFF',
                    green: '#34C759',
                    indigo: '#5856D6',
                    orange: '#FF9500',
                    pink: '#FF2D55',
                    purple: '#AF52DE',
                    red: '#FF3B30',
                    teal: '#5AC8FA',
                    yellow: '#FFCC00',
                    // iOS Gray Scale
                    gray: {
                        50: '#F2F2F7',
                        100: '#E5E5EA',
                        200: '#D1D1D6',
                        300: '#C7C7CC',
                        400: '#AEAEB2',
                        500: '#8E8E93',
                        600: '#636366',
                        700: '#48484A',
                        800: '#3A3A3C',
                        900: '#2C2C2E',
                        950: '#1C1C1E',
                    },
                },
                primary: '#007AFF',
                secondary: '#1C1C1E',
                accent: '#FF9500',
            },
            borderRadius: {
                'ios': '10px',
                'ios-lg': '12px',
                'ios-xl': '14px',
                'ios-2xl': '20px',
                'ios-3xl': '28px',
            },
            spacing: {
                '88': '22rem',
                '128': '32rem',
            },
            boxShadow: {
                'ios': '0 2px 8px rgba(0, 0, 0, 0.08)',
                'ios-md': '0 4px 16px rgba(0, 0, 0, 0.12)',
                'ios-lg': '0 8px 24px rgba(0, 0, 0, 0.15)',
                'ios-xl': '0 12px 32px rgba(0, 0, 0, 0.18)',
            },
            backdropBlur: {
                'ios': '20px',
            },
            transitionTimingFunction: {
                'ios': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
                'ios-spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            },
            animation: {
                'slide-up': 'slideUp 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                'slide-down': 'slideDown 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                'fade-in': 'fadeIn 0.2s ease-in-out',
                'scale-in': 'scaleIn 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            },
            keyframes: {
                slideUp: {
                    '0%': { transform: 'translateY(100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.9)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
