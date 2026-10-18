export function Stars({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`tracking-wider ${className}`} aria-label={`${n} 星`}>
      {'★'.repeat(n)}
      <span className="opacity-30">{'★'.repeat(3 - n)}</span>
    </span>
  )
}
