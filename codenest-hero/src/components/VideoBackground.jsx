import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

const STREAM_URL =
  'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8'

export default function VideoBackground() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: false })
      hls.loadSource(STREAM_URL)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = STREAM_URL
    }

    return () => {
      if (hls) hls.destroy()
    }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink">
      <video
        ref={videoRef}
        className="h-full w-full object-cover opacity-60"
        autoPlay
        muted
        loop
        playsInline
      />

      {/* left-to-right dark gradient for text readability */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#070b0a_0%,rgba(7,11,10,0.4)_45%,transparent_80%)]" />

      {/* bottom-up gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#070b0a_0%,transparent_45%)]" />

      {/* vertical grid lines at 25 / 50 / 75% (desktop only) */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <div className="absolute inset-y-0 left-1/4 w-px bg-white/10" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-white/10" />
      </div>

      {/* central glow */}
      <svg
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        width="1200"
        height="600"
        viewBox="0 0 1200 600"
        fill="none"
      >
        <defs>
          <filter id="glow-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="25" />
          </filter>
          <radialGradient id="glow-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5ed29c" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#0f3d33" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#070b0a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="600"
          cy="120"
          rx="480"
          ry="160"
          fill="url(#glow-fill)"
          filter="url(#glow-blur)"
        />
      </svg>
    </div>
  )
}
