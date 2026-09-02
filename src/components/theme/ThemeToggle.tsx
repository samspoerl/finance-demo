'use client'

import { Button } from '@/components/ui/Button'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

/**
 * Light / dark, one button visible at a time.
 *
 * Both buttons are always rendered and CSS picks which one shows, rather than
 * the theme being read to decide what to return. That is the whole trick: the
 * resolved theme isn't knowable on the server or on the first client render, so
 * a component that branches on `useTheme()` has to wait for mount — which means
 * rendering nothing, or the wrong icon, and then swapping it. next-themes'
 * inline script sets `.dark` on <html> before the page paints, so `dark:hidden`
 * is already correct in that first frame and there is no flash to avoid.
 *
 * `setTheme` still needs the hook, but only inside a handler, where the value is
 * real.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <>
      <Button
        variant="quiet"
        onClick={() => setTheme('dark')}
        aria-label="Switch to dark theme"
        className="w-[34px] px-0 dark:hidden"
      >
        <SunIcon className="size-[15px]" />
      </Button>
      <Button
        variant="quiet"
        onClick={() => setTheme('light')}
        aria-label="Switch to light theme"
        className="hidden w-[34px] px-0 dark:inline-flex"
      >
        <MoonIcon className="size-[15px]" />
      </Button>
    </>
  )
}
