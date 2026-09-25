import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import { Search, X } from 'lucide-react';
import './mui-fields.css';

/**
 * Mechanical MUI counterparts for the bare shadcn `Input` / native search
 * inputs used across the admin editors. No new visual decisions — the MUI
 * outlined control owns border/padding (see `mui-fields.css`, which
 * neutralizes the native-field rules for MUI internals), M3 tokens come
 * from `mui-theme.jsx`.
 */

/**
 * RHF-bound text input. `field` is the react-hook-form Controller field
 * ({ value, onChange, onBlur, name, ref }) passed by `EditorField` children.
 * The ref is mapped to the native input via `inputRef` (a plain `ref` spread
 * would land on the TextField root and break RHF focus management).
 * `FormControl` Slot props (id, aria-invalid, aria-describedby) are mapped
 * onto the native input via `inputProps`.
 *
 *   {(field) => <MuiInput field={field} />}
 *   {(field) => <MuiInput field={field} maxLength={80} placeholder="…" />}
 */
export function MuiInput({ field, maxLength, min, max, step, ...props }) {
  const { ref, ...fieldRest } = field ?? {};
  const {
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedby,
    inputProps: inputPropsProp,
    ...rest
  } = props;
  const invalid = ariaInvalid === true || ariaInvalid === 'true';
  return (
    <TextField
      {...fieldRest}
      {...rest}
      id={id}
      className={['mui-field', rest.className].filter(Boolean).join(' ')}
      variant="outlined"
      fullWidth
      value={fieldRest.value ?? rest.value ?? ''}
      inputRef={ref}
      error={invalid || rest.error}
      inputProps={{
        maxLength,
        min,
        max,
        step,
        'aria-invalid': ariaInvalid,
        'aria-describedby': ariaDescribedby,
        ...inputPropsProp,
      }}
    />
  );
}

const SEARCH_CLEAR_LABEL = 'Clear search';

/**
 * Controlled toolbar search field — the shared pattern for DataTable,
 * MediaPicker, and the gallery-categories toolbar. Default MUI TextField
 * best practice: `label` names the field via `aria-label` on the native
 * input (no visible label, so toolbar layout is unchanged), `placeholder`
 * is hint text only, search-icon adornment is aria-hidden, and a clear
 * IconButton with an accessible label appears when there is a value.
 * Controlled (`value`/`onChange` stay immediate; `?q=` + 250ms debounce
 * live in the page via `useDebouncedValue`); `aria-live="polite"` count
 * rendered by the caller. When no `label` is passed (MediaPicker), the
 * input stays labelled by the owning `Field` label via `inputProps`.
 */
export function MuiSearchField({
  id,
  label,
  inputProps: inputPropsProp,
  value,
  onChange,
  placeholder,
  disabled,
  size = 'small',
  autoComplete = 'off',
}) {
  const searchId = id ?? inputPropsProp?.id;
  const hasValue = String(value ?? '') !== '';
  return (
    <TextField
      id={searchId}
      type="search"
      className="mui-field mui-search-field"
      variant="outlined"
      size={size}
      value={value ?? ''}
      placeholder={placeholder ?? (typeof label === 'string' ? label : undefined)}
      autoComplete={autoComplete}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      inputProps={{ 'aria-label': label, ...inputPropsProp, id: undefined }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search size={18} aria-hidden="true" />
            </InputAdornment>
          ),
          endAdornment: hasValue ? (
            <InputAdornment position="end">
              <IconButton
                type="button"
                size="small"
                aria-label={SEARCH_CLEAR_LABEL}
                disabled={disabled}
                onClick={() => onChange?.('')}
                edge="end"
              >
                <X size={18} aria-hidden="true" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}
