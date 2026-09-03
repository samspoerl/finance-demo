import { AppIcon } from '@/components/shared/AppIcon'
import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <AppIcon iconWidth={24} iconHeight={24} borderRadius="25%" />,
    {
      ...size,
    }
  )
}
