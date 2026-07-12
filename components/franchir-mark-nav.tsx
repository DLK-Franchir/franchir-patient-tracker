/** Navy-header wordmark icon from V3 prototype */
export function FranchirMarkNav({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 72 Q50 8 92 72"
        stroke="white"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M15 72 Q50 18 85 72"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path d="M8 72 Q50 8 68 38 Q44 28 20 72 Z" fill="#E8534A" opacity="0.95" />
      <circle cx="84" cy="26" r="9" fill="#E8534A" />
    </svg>
  )
}
