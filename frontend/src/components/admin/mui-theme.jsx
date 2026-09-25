import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';

/**
 * Admin MUI theme — mechanical mapping of the existing M3 tokens, no new
 * visual decisions.
 *
 * Token source of truth is `src/index.css` (`--md-sys-color-*` canonical
 * roles, `--m3-*` compat aliases). The light/dark hex values are mirrored
 * below and `buildAdminMuiTheme(mode)` returns a PLAIN (non-CSS-vars)
 * theme per mode — deliberately NOT `colorSchemes`/`colorSchemeSelector`:
 * in MUI v9 a vars theme makes even plain `ThemeProvider` delegate to an
 * internal `CssVarsProvider` with its own system-mode state machine that
 * writes `.dark` onto `document.documentElement` globally. That second
 * driver fought the admin-scoped toggle (stuck dark, public site polluted).
 * Here the React `mode` state in `AdminMuiProvider` is the single driver:
 * it swaps the theme object AND scopes a `dark` class to a wrapper div so
 * the index.css `.dark` M3 tokens flip for the admin tree only. Nothing
 * touches `documentElement`: the public site is unaffected.
 *
 * Typography mirrors the existing stack: Display/Headline/Title on
 * Google Sans, Body/Label on Roboto Flex (spec §2.2, index.css
 * `--font-heading` / `--font-sans`). Buttons keep their authored case
 * (`textTransform: none`) to match the pill shadcn buttons they replace.
 *
 * Provided around the admin route tree only (see `AdminShell.jsx`) — the
 * public site never sees this theme. No global `CssBaseline` (it conflicts
 * with the Tailwind Preflight base); no `ScopedCssBaseline` (not needed —
 * migrated components keep their layout classes).
 */

const FONT_STACK = '"Google Sans", "Google Sans Flex", "Roboto Flex", Roboto, system-ui, -apple-system, "Segoe UI", sans-serif';
const BODY_STACK = '"Roboto Flex", Roboto, "Google Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

const adminLightPalette = {
  primary: {
    main: '#0B57D0',
    light: '#D3E3FD',
    dark: '#041E49',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#575E71',
    light: '#DBE2F9',
    dark: '#111C2B',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#BA1A1A',
    light: '#FFDAD6',
    dark: '#410002',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#FEF7FF',
    paper: '#FEF7FF',
  },
  text: {
    primary: '#1D1B20',
    secondary: '#49454E',
    disabled: 'rgba(29, 27, 32, 0.38)',
  },
  divider: '#CAC4D0',
  action: {
    active: 'rgba(29, 27, 32, 0.54)',
    hover: 'rgba(29, 27, 32, 0.08)',
    hoverOpacity: 0.08,
    selected: 'rgba(29, 27, 32, 0.08)',
    selectedOpacity: 0.08,
    disabled: 'rgba(29, 27, 32, 0.26)',
    disabledBackground: 'rgba(29, 27, 32, 0.12)',
    disabledOpacity: 0.38,
    focus: 'rgba(29, 27, 32, 0.10)',
    focusOpacity: 0.1,
    activatedOpacity: 0.1,
  },
};

const adminDarkPalette = {
  primary: {
    main: '#A8C7FA',
    light: '#D3E3FD',
    dark: '#0842A0',
    contrastText: '#003060',
  },
  secondary: {
    main: '#BFC6DC',
    light: '#DBE2F9',
    dark: '#3E4759',
    contrastText: '#283141',
  },
  error: {
    main: '#FFB4AB',
    light: '#FFDAD6',
    dark: '#93000A',
    contrastText: '#690005',
  },
  background: {
    default: '#141218',
    paper: '#141218',
  },
  text: {
    primary: '#E6E0E9',
    secondary: '#CAC4D0',
    disabled: 'rgba(230, 224, 233, 0.38)',
  },
  divider: '#49454F',
  action: {
    active: 'rgba(230, 224, 233, 0.54)',
    hover: 'rgba(230, 224, 233, 0.08)',
    hoverOpacity: 0.08,
    selected: 'rgba(230, 224, 233, 0.08)',
    selectedOpacity: 0.08,
    disabled: 'rgba(230, 224, 233, 0.26)',
    disabledBackground: 'rgba(230, 224, 233, 0.12)',
    disabledOpacity: 0.38,
    focus: 'rgba(230, 224, 233, 0.10)',
    focusOpacity: 0.1,
    activatedOpacity: 0.1,
  },
};

const adminThemeBase = {
  shape: {
    // M3 extra-small — the dense input/select shape used across admin.
    borderRadius: 4,
  },
  typography: {
    fontFamily: BODY_STACK,
    h1: { fontFamily: FONT_STACK },
    h2: { fontFamily: FONT_STACK },
    h3: { fontFamily: FONT_STACK },
    h4: { fontFamily: FONT_STACK },
    h5: { fontFamily: FONT_STACK },
    h6: { fontFamily: FONT_STACK },
    // Preserve authored button case (MUI defaults to uppercase).
    button: { textTransform: 'none', fontFamily: BODY_STACK },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        // Preserve authored button case (MUI defaults to uppercase);
        // shape stays the MUI default (per-button radius classes own it).
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--m3-shape-corner-xs, 4px)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--m3-outline)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--m3-on-surface)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--m3-primary)',
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--m3-error)',
          },
        },
        input: {
          color: 'var(--m3-on-surface)',
          '&::placeholder': {
            color: 'var(--m3-on-surface-variant)',
            opacity: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'var(--m3-on-surface-variant)',
          '&.Mui-focused': { color: 'var(--m3-primary)' },
          '&.Mui-error': { color: 'var(--m3-error)' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '14px',
          lineHeight: '20px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--m3-outline-variant)',
          color: 'var(--m3-on-surface)',
        },
        head: {
          fontWeight: 500,
          letterSpacing: '0.1px',
          color: 'var(--m3-on-surface-variant)',
          backgroundColor: 'var(--m3-surface-container)',
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { color: 'var(--m3-on-surface-variant)' },
        toolbar: { minHeight: '52px' },
        selectLabel: { fontSize: '12px' },
        displayedRows: { fontSize: '12px' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--m3-surface)',
          backgroundImage: 'none',
          boxShadow: 'none',
          border: '1px solid var(--m3-outline-variant)',
          borderRadius: '4px',
          overflow: 'hidden',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: '14px' },
      },
    },
  },
};

/**
 * Plain per-mode theme (no CSS-vars schemes, so `ThemeProvider` takes the
 * no-vars path: no internal color-scheme state, no `documentElement`
 * writes). The returned theme object is what `AdminMuiProvider` swaps on
 * toggle — the single driver for both modes.
 */
export function buildAdminMuiTheme(mode) {
  return createTheme({
    palette: mode === 'dark' ? adminDarkPalette : adminLightPalette,
    ...adminThemeBase,
  });
}

export const adminMuiTheme = buildAdminMuiTheme('light');

/** ThemeProvider scoped to the admin route tree only (wired in `AdminShell.jsx`). */
const THEME_MODE_STORAGE_KEY = 'm3-admin-theme-mode';

function getInitialThemeMode() {
  try {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {}
  return 'light';
}

const AdminThemeModeContext = createContext({
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
});

/** Read/toggle the admin-only theme mode inside `AdminMuiProvider` scope. */
export function useAdminThemeMode() {
  return useContext(AdminThemeModeContext);
}

export function AdminMuiProvider({ children }) {
  const [mode, setModeState] = useState(getInitialThemeMode);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const setMode = useCallback((next) => {
    setModeState(next === 'dark' ? 'dark' : 'light');
  }, []);
  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);
  const theme = useMemo(() => buildAdminMuiTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);

  return (
    <ThemeProvider theme={theme}>
      <AdminThemeModeContext.Provider value={value}>
        {/* Scoped `dark` class: flips the index.css `.dark` M3 tokens for
            the admin tree only (MUI components follow the swapped theme
            object above). Public site unaffected. */}
        <div className={mode === 'dark' ? 'dark' : undefined} style={{ colorScheme: mode }}>
          {children}
        </div>
      </AdminThemeModeContext.Provider>
    </ThemeProvider>
  );
}

export default adminMuiTheme;
