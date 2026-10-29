/**
 * Small styled building blocks on top of Radix primitives. Tailwind only, light + dark.
 * Contrast: body text zinc-900 / zinc-100, secondary text zinc-600 / zinc-400 (≥ 4.5:1 on the panels).
 */
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Slider as RSlider, Switch as RSwitch, ToggleGroup, Tooltip } from 'radix-ui';
import type { Side } from '@/contract';
import { cx, focusRing } from './classes';
import { Icon, type IconName } from './Icon';

type Variant = 'ghost' | 'subtle' | 'primary' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'icon' | 'iconSm';

const VARIANTS: Record<Variant, string> = {
  ghost: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
  subtle:
    'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  primary:
    'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-zinc-950 dark:hover:bg-teal-300',
  outline:
    'border border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800',
  danger: 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3 text-sm gap-2',
  icon: 'size-9',
  iconSm: 'size-7',
};

const PRESSED =
  'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-600/30 hover:bg-teal-100 dark:bg-teal-400/15 dark:text-teal-200 dark:ring-teal-400/30 dark:hover:bg-teal-400/25';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Toggle buttons: sets aria-pressed and the pressed style. */
  pressed?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'ghost',
  size = 'md',
  pressed,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-medium whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-45 motion-safe:transition-colors',
        focusRing,
        SIZES[size],
        pressed ? PRESSED : VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}

/** Icon-only button with an accessible name and a tooltip. */
export function IconButton({
  icon,
  label,
  shortcut,
  tooltipSide = 'top',
  size = 'icon',
  iconClassName = 'size-[18px]',
  ...rest
}: Omit<ButtonProps, 'children'> & {
  icon: IconName;
  label: string;
  shortcut?: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  iconClassName?: string;
}) {
  return (
    <Tip label={label} shortcut={shortcut} side={tooltipSide}>
      <Button size={size} aria-label={label} {...rest}>
        <Icon name={icon} className={iconClassName} />
      </Button>
    </Tip>
  );
}

export function Tip({
  label,
  shortcut,
  side = 'top',
  children,
}: {
  label: string;
  shortcut?: string | undefined;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          {label}
          {shortcut ? (
            <kbd className="ml-2 rounded bg-white/15 px-1 font-sans text-[11px] dark:bg-zinc-900/10">
              {shortcut}
            </kbd>
          ) : null}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      disabled={disabled}
      className={cx(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-zinc-300 data-[state=checked]:bg-teal-700 disabled:opacity-50 dark:bg-zinc-600 dark:data-[state=checked]:bg-teal-400 motion-safe:transition-colors',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
        focusRing,
      )}
    >
      <RSwitch.Thumb
        className={cx(
          'block rounded-full bg-white shadow ring-1 ring-black/5 motion-safe:transition-transform',
          size === 'sm'
            ? 'size-4 translate-x-0.5 data-[state=checked]:translate-x-[18px]'
            : 'size-5 translate-x-0.5 data-[state=checked]:translate-x-[22px]',
        )}
      />
    </RSwitch.Root>
  );
}

export function Slider({
  value,
  onValueChange,
  label,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  valueText,
  className,
}: {
  value: number;
  onValueChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  valueText?: string;
  className?: string;
}) {
  return (
    <RSlider.Root
      value={[value]}
      onValueChange={(v) => onValueChange(v[0] ?? value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cx(
        'relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-45',
        className,
      )}
    >
      <RSlider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <RSlider.Range className="absolute h-full rounded-full bg-teal-700 dark:bg-teal-400" />
      </RSlider.Track>
      <RSlider.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className={cx(
          'block size-4 cursor-grab rounded-full border-2 border-teal-700 bg-white shadow active:cursor-grabbing dark:border-teal-400 dark:bg-zinc-900',
          focusRing,
        )}
      />
    </RSlider.Root>
  );
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: string; title?: string }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className="inline-flex shrink-0 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.title ?? o.label}
          title={o.title}
          className={cx(
            'cursor-pointer rounded-md font-medium text-zinc-700 hover:text-zinc-950 data-[state=on]:bg-white data-[state=on]:text-zinc-950 data-[state=on]:shadow-sm dark:text-zinc-300 dark:hover:text-white dark:data-[state=on]:bg-zinc-600 dark:data-[state=on]:text-white',
            size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-sm',
            focusRing,
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function SystemChip({ color, className = 'size-3' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/20', className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function SideBadge({ side, label }: { side: Side; label: string }) {
  return (
    <abbr
      title={label}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-zinc-200 px-1 text-[11px] font-semibold text-zinc-800 no-underline dark:bg-zinc-700 dark:text-zinc-100"
    >
      {side === 'left' ? 'L' : 'R'}
    </abbr>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warn' | 'info';
  title?: string;
}) {
  const tones = {
    neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    warn: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
    info: 'bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200',
  };
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = 'size-4', label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} aria-label={label} className="inline-flex">
      <Icon name="spinner" className={cx(className, 'text-teal-700 dark:text-teal-400')} />
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-zinc-300 bg-zinc-50 px-1 font-sans text-[11px] font-semibold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </kbd>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="text-[11px] font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400"
    >
      {children}
    </h3>
  );
}
