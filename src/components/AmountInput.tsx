import { useId } from 'react';
import { isExpression, parseAmount, stringifyAmount } from '../lib/parseAmount';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  /**
   * Visual hint label below the preview (e.g. "USD"). Optional.
   */
  unit?: string;
}

const PREVIEW_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 8,
};

export default function AmountInput({
  value,
  onChange,
  placeholder,
  className,
  required,
  unit,
}: Props) {
  const id = useId();
  const showPreview = isExpression(value);
  const evaluated = showPreview ? parseAmount(value) : null;

  function handleBlur() {
    if (!showPreview) return;
    const result = parseAmount(value);
    if (result !== null) onChange(stringifyAmount(result));
  }

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className ?? 'input text-right tabular-nums'}
        required={required}
        spellCheck={false}
      />
      {showPreview && (
        <div className="mt-1 text-right text-xs text-gray-500 tabular-nums">
          {evaluated === null
            ? '（無法計算）'
            : `= ${evaluated.toLocaleString('en-US', PREVIEW_FORMAT)}${unit ? ` ${unit}` : ''}`}
        </div>
      )}
    </div>
  );
}
