import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Switch from '@mui/material/Switch';
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
  const { helperText, error: errorProp, ...textFieldRest } = rest;
  return (
    <TextField
      {...fieldRest}
      {...textFieldRest}
      id={id}
      className={['mui-field', textFieldRest.className].filter(Boolean).join(' ')}
      variant="outlined"
      fullWidth
      value={fieldRest.value ?? textFieldRest.value ?? ''}
      inputRef={ref}
      error={invalid || !!errorProp}
      helperText={helperText}
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

/**
 * RHF-bound boolean input — the stock MUI replacement for the custom
 * shared `Toggle`. `field` is the react-hook-form Controller field;
 * the boolean travels via `checked`/`onChange(checked)` so page handlers
 * keep their `(value) => …` signatures unchanged. Validation errors render
 * as MUI `FormHelperText`, matching `MuiInput`'s `helperText` pattern.
 *
 *   {(field) => <MuiSwitchField field={field} id="tm-active" label="Active" />}
 */
export function MuiSwitchField({ field, id, label, disabled, errorText }) {
  const { ref, value, onChange, onBlur, name } = field ?? {};
  return (
    <>
      <FormControlLabel
        label={label}
        disabled={disabled}
        control={(
          <Switch
            id={id}
            name={name}
            checked={!!value}
            disabled={disabled}
            inputRef={ref}
            onBlur={onBlur}
            onChange={(e) => onChange?.(e.target.checked)}
          />
        )}
      />
      {errorText ? <FormHelperText error>{errorText}</FormHelperText> : null}
    </>
  );
}

/**
 * Toolbar search field — 100% stock MUI, zero custom modifications.
 * Plain docs-standard outlined TextField: `label` renders as
 * inside-placeholder text when empty and animates into the top-border
 * notch on focus/value. `placeholder` is never set. Clearing is native
 * (Esc / select-delete). `value`/`onChange` wiring only; `?q=` + 250ms
 * debounce live in the page via `useDebouncedValue`.
 */
export function MuiSearchField({
  id,
  label,
  value,
  onChange,
  disabled,
  size = 'small',
  autoComplete = 'off',
}) {
  return (
    <TextField
      id={id}
      type="search"
      variant="outlined"
      size={size}
      label={label}
      value={value ?? ''}
      autoComplete={autoComplete}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
