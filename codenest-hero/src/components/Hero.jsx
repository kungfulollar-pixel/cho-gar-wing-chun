import { ArrowRight } from 'lucide-react'
import Header from './Header'
import VideoBackground from './VideoBackground'
import GlassCard from './GlassCard'

export default function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-ink">
      <VideoBackground />
      <Header />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <GlassCard />

        <p className="font-jakarta text-[11px] font-bold uppercase tracking-[0.2em] text-mint">
          Career-Ready Curriculum
        </p>

        <h1 className="mt-4 max-w-5xl font-sans text-[40px] font-extrabold uppercase leading-[0.95] tracking-tight text-white md:text-[72px]">
          Launch your coding career
          <span className="text-mint">.</span>
        </h1>

        <p className="mt-6 max-w-[512px] text-[14px] leading-relaxed text-white/70">
          Master in-demand coding skills with project-based courses,
          mentorship, and a curriculum designed alongside engineers hiring
          today.
        </p>

        <button
          type="button"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-mint px-7 py-3 text-[13px] font-bold uppercase tracking-wide text-ink transition-transform hover:scale-105"
        >
          Get Started
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  )
}
