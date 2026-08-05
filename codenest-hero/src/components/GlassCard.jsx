export default function GlassCard() {
  return (
    <div className="liquid-glass flex h-[200px] w-[200px] -translate-y-[50px] flex-col justify-between rounded-2xl p-4">
      <span className="font-jakarta text-[14px] font-semibold tracking-wide text-white/70">
        [ 2025 ]
      </span>

      <div>
        <p className="text-[18px] leading-snug text-white">
          Taught by{' '}
          <span className="font-serif italic text-mint">Industry</span>{' '}
          Professionals
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          Real-world curriculum built and reviewed by senior engineers
          currently working in the field.
        </p>
      </div>
    </div>
  )
}
