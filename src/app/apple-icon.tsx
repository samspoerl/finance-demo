import { AppIcon } from '@/components/shared/AppIcon'
import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <AppIcon iconWidth={120} iconHeight={120} borderRadius="22%" />,
    {
      ...size,
    }
  )
}
