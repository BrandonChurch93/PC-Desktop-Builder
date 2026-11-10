import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import s from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'icon';
  icon?: IconName;
  /** an icon button's name, shown as its tooltip */
  label?: string;
  block?: boolean;
  selected?: boolean;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = 'ghost', icon, label, block, selected, className, children, type = 'button', ...rest }, ref) {
  const cls = [s.button, s[variant], block ? s.block : '', selected ? s.selected : '', className ?? ''].join(' ');
  return (
    <button ref={ref} type={type} className={cls} aria-label={variant === 'icon' ? label : rest['aria-label']} data-tip={variant === 'icon' ? label : undefined} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
});

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & { on: boolean; onChange: (on: boolean) => void; icon?: IconName; compact?: boolean; children: ReactNode };

/** A pill toggle: Glass, Power, Airflow, Synced. */
export function Chip({ on, onChange, icon, compact, children, className, ...rest }: ChipProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className={[s.chip, on ? s.chipOn : '', compact ? s.chipCompact : '', className ?? ''].join(' ')} onClick={() => onChange(!on)} {...rest}>
      {icon && <Icon name={icon} />}
      <span className={compact ? 'sr-only' : s.chipText}>{children}</span>
    </button>
  );
}
