interface AlertBannerProps {
  type: 'warning' | 'error' | 'info'
  message: string
}

const styles = {
  warning: 'bg-amber-950 border-amber-600 text-amber-300',
  error: 'bg-red-950 border-red-600 text-red-300',
  info: 'bg-blue-950 border-blue-600 text-blue-300',
}

export default function AlertBanner({ type, message }: AlertBannerProps) {
  return (
    <div className={`px-4 py-3 rounded-lg border text-sm font-medium ${styles[type]}`}>
      {message}
    </div>
  )
}
