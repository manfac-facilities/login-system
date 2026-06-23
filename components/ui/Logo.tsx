import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'navy' | 'white'
  priority?: boolean
}

const sizes = {
  sm: { width: 120, height: 36 },
  md: { width: 160, height: 48 },
  lg: { width: 200, height: 60 },
}

const sources = {
  navy: '/logo.png',
  white: '/logo-white.png',
}

export default function Logo({ size = 'md', variant = 'navy', priority = false }: LogoProps) {
  const { width, height } = sizes[size]
  return (
    <Image
      src={sources[variant]}
      alt="Manfac Facilities"
      width={width}
      height={height}
      priority={priority}
    />
  )
}
