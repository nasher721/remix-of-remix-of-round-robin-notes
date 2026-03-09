import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
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

    React.useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")
        const resolved = theme === "system" ? getSystemTheme() : theme
        root.classList.add(resolved)
    }, [theme])

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
    }), [theme, storageKey])

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
