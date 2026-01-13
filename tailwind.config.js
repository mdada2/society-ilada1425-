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
                sans: ['DVOT SurekhMR', 'serif'],
            },
            colors: {
                primary: '#1e40af', // blue-800
                secondary: '#1e293b', // slate-800
                accent: '#f59e0b', // amber-500
            }
        },
    },
    plugins: [],
}
