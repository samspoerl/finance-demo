import { cn } from '@/lib/utils'
import { Button as BaseButton } from '@base-ui/react/button'
import { ComponentProps } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive'
type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary:
    'border border-border-strong text-foreground-strong hover:bg-surface-strong',
  quiet: 'border border-border text-foreground-muted hover:bg-surface-strong',
  destructive:
    'border border-border-strong text-negative hover:bg-surface-strong',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-[34px] px-3.5 text-[13px]',
}

/**
 * `className` is narrowed to a string: Base UI also accepts a function of
 * component state, but `cn()` merges strings and nothing here needs the state
 * form.
 */
interface ButtonProps extends Omit<
  ComponentProps<typeof BaseButton>,
  'className'
> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-40',
        sizeClass[size],
        variantClass[variant],
        className
      )}
      {...props}
    />
  )
}
