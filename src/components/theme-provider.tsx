import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

const HIGH_CONTRAST_KEY = "vite-ui-high-contrast"

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    highContrast: boolean
    setHighContrast: (value: boolean) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    highContrast: false,
    setHighContrast: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

function getSystemTheme(): "dark" | "light" {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
    const [theme, setTheme] = React.useState<Theme>(
        () => (typeof window !== "undefined" ? localStorage.getItem(storageKey) as Theme : null) || defaultTheme
    )

    const [highContrast, setHighContrastState] = React.useState<boolean>(() =>
        typeof window !== "undefined" ? localStorage.getItem(HIGH_CONTRAST_KEY) === "true" : false
    )

    React.useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")
        const resolved = theme === "system" ? getSystemTheme() : theme
        root.classList.add(resolved)
    }, [theme])

    React.useEffect(() => {
        const root = window.document.documentElement
        if (highContrast) root.classList.add("high-contrast")
        else root.classList.remove("high-contrast")
    }, [highContrast])

    React.useEffect(() => {
        if (theme === "system") {
            const mql = window.matchMedia("(prefers-color-scheme: dark)")
            const handler = () => {
                const root = window.document.documentElement
                root.classList.remove("light", "dark")
                root.classList.add(getSystemTheme())
            }
            mql.addEventListener("change", handler)
            return () => mql.removeEventListener("change", handler)
        }
    }, [theme])

    const value = React.useMemo(() => ({
        theme,
        setTheme: (t: Theme) => {
            localStorage.setItem(storageKey, t)
            setTheme(t)
        },
        highContrast,
        setHighContrast: (v: boolean) => {
            localStorage.setItem(HIGH_CONTRAST_KEY, v ? "true" : "false")
            setHighContrastState(v)
        },
    }), [theme, storageKey, highContrast])

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = React.useContext(ThemeProviderContext)
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")
    return context
}
