'use client'

import { useServerAction } from '@/hooks/use-server-action'
import { updateTransaction } from '@/lib/actions/transaction'
import type { CategoryDto } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Menu } from '@base-ui/react/menu'
import { CheckIcon } from 'lucide-react'

type TransactionType = 'income' | 'expense' | 'excluded'

interface TransactionCategoryMenuProps {
  transactionId: number
  type: TransactionType
  categoryId: number | null
  categoryName: string | null
  categories: CategoryDto[]
}

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'excluded', label: 'Excluded from cash flow' },
]

/**
 * The one interactive cell in the transactions table: it sets both a
 * transaction's type and its category, because those are the two things that
 * decide how a row is counted and a viewer thinks of them as one correction.
 *
 * Base UI rather than a hand-rolled dropdown — this is exactly the invisible
 * half the rule is about: dismissal, focus return, roving keyboard navigation
 * across two radio groups, and viewport-edge positioning on a row near the
 * bottom of the page.
 *
 * No optimistic update. `revalidateApp()` in the action re-renders the page from
 * the server, which is what the KPI row and the chart above need — a
 * recategorize moves the income and expense figures, not just this chip.
 *
 * Each `Menu.GroupLabel` must sit *inside* its `Menu.RadioGroup`, not above it.
 * The label reads a context the group provides and registers its id there for
 * `aria-labelledby`; as a sibling it throws on open, not at build time, so the
 * table renders fine and the menu dies on the first click.
 */
export function TransactionCategoryMenu({
  transactionId,
  type,
  categoryId,
  categoryName,
  categories,
}: TransactionCategoryMenuProps) {
  const { run, pending } = useServerAction()

  const chipClass =
    type === 'excluded'
      ? 'border-border-strong text-foreground-subtle border border-dashed'
      : type === 'income'
        ? 'bg-positive-surface text-positive border-positive-surface border'
        : 'bg-surface-strong text-foreground-muted border'

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={pending}
        className={cn(
          'cursor-pointer rounded px-2 py-0.5 text-xs transition-opacity disabled:opacity-50',
          chipClass
        )}
      >
        {type === 'excluded'
          ? 'Excluded'
          : type === 'income'
            ? 'Income'
            : (categoryName ?? 'Uncategorized')}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-50">
          <Menu.Popup className="bg-surface flex max-h-[320px] w-64 flex-col overflow-y-auto rounded-lg border p-1 shadow-lg">
            <Menu.RadioGroup
              value={type}
              onValueChange={(next) =>
                run({
                  action: () =>
                    updateTransaction(transactionId, {
                      type: next as TransactionType,
                    }),
                })
              }
            >
              <Menu.GroupLabel className="text-foreground-subtle px-2 py-1.5 text-[11px] font-medium tracking-wider uppercase">
                Treat as
              </Menu.GroupLabel>
              {TYPES.map((option) => (
                <Menu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="data-[highlighted]:bg-surface-strong flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-[13px] outline-none"
                >
                  {option.label}
                  <Menu.RadioItemIndicator>
                    <CheckIcon className="size-3.5" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>

            <Menu.Separator className="my-1 h-px bg-[var(--color-border)]" />

            <Menu.RadioGroup
              value={categoryId ?? -1}
              onValueChange={(next) =>
                run({
                  action: () =>
                    updateTransaction(transactionId, {
                      categoryId: next === -1 ? null : Number(next),
                    }),
                })
              }
            >
              <Menu.GroupLabel className="text-foreground-subtle px-2 py-1.5 text-[11px] font-medium tracking-wider uppercase">
                Category
              </Menu.GroupLabel>
              <Menu.RadioItem
                value={-1}
                className="data-[highlighted]:bg-surface-strong flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-[13px] outline-none"
              >
                Uncategorized
                <Menu.RadioItemIndicator>
                  <CheckIcon className="size-3.5" />
                </Menu.RadioItemIndicator>
              </Menu.RadioItem>
              {categories.map((category) => (
                <Menu.RadioItem
                  key={category.id}
                  value={category.id}
                  className="data-[highlighted]:bg-surface-strong flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-[13px] outline-none"
                >
                  <span className="min-w-0 truncate">
                    {category.category} · {category.subcategory}
                  </span>
                  <Menu.RadioItemIndicator className="shrink-0">
                    <CheckIcon className="size-3.5" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
