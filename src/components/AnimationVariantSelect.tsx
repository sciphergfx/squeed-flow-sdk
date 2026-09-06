import { ToolbarSelect } from "./toolbarControls";

export function AnimationVariantSelect<Variant extends string>({ label, value, options, onChange, disabled }: {
  label: string;
  value: Variant | "";
  options: readonly { value: Variant; label: string }[];
  onChange: (value: Variant) => void;
  disabled?: boolean;
}) {
  return <ToolbarSelect aria-label={label} title={`Animation: ${options.find(option => option.value === value)?.label ?? "Mixed"}`}
    value={value} style={{ width: 104 }} disabled={disabled}
    onValueChange={next => { const option = options.find(option => option.value === next); if (option) onChange(option.value); }}>
    {value === "" && <option value="" disabled>Mixed</option>}
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </ToolbarSelect>;
}