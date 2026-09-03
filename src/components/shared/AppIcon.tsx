interface AppIconProps {
  iconWidth: number | string
  iconHeight: number | string
  borderRadius?: string
  padding?: string
  stroke?: string
}

export function AppIcon({
  iconWidth,
  iconHeight,
  borderRadius = '0',
  padding,
  stroke = 'white',
}: AppIconProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        borderRadius,
        ...(padding && { padding }),
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={iconWidth}
        height={iconHeight}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 7h6v6" />
        <path d="m22 7-8.5 8.5-5-5L2 17" />
      </svg>
    </div>
  )
}
