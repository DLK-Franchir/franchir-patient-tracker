export function BadgeStatus({ status }: { status: any }) {
  return (
    <span 
      className="px-2 py-1 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: status.color || '#6B7280' }}
    >
      {status.label}
    </span>
  )
}
