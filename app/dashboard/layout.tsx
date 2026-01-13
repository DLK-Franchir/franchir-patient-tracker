import FranchirHeader from '@/components/franchir-header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <FranchirHeader />
      {children}
    </div>
  )
}
