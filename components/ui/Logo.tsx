import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  priority?: boolean
}

const sizes = {
  sm: { width: 120, height: 36 },
  md: { width: 160, height: 48 },
  lg: { width: 200, height: 60 },
}

export default function Logo({ size = 'md', priority = false }: LogoProps) {
  const { width, height } = sizes[size]
  return (
    <Image
      src="/logo-white.png"
      alt="Manfac Facilities"
      width={width}
      height={height}
      priority={priority}
    />
  )
}
