import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

/**
 * The only container in the app: a bordered white panel on a tinted canvas, no
 * shadow. Depth comes from the border and the canvas behind it.
 *
 * Deliberately no padding: some cards pad their content (the stat cards) and
 * some are a header plus flush-edge rows (accounts, transactions), and a
 * primitive that assumed either would be fought at half its call sites.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-surface rounded-lg border', className)} {...props} />
  )
}

/** A card's header row: title on the left, an action or caption on the right. */
export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b px-6 py-4',
        className
      )}
      {...props}
    />
  )
}
