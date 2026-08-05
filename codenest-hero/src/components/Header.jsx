import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const LINKS = ['PROJECTS', 'BLOG', 'ABOUT', 'RESUME']

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <a href="#" className="text-xl font-extrabold tracking-tight text-white">
          Code<span className="text-mint">Nest</span>
        </a>

        <nav className="hidden items-center gap-10 md:flex">
          {LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-[16px] text-white transition-colors hover:text-mint"
            >
              {link}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="text-white md:hidden"
        >
          <Menu size={28} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-ink">
          <div className="flex items-center justify-between px-6 py-6">
            <span className="text-xl font-extrabold tracking-tight text-white">
              Code<span className="text-mint">Nest</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="text-white"
            >
              <X size={28} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col items-center justify-center gap-8">
            {LINKS.map((link) => (
              <a
                key={link}
                href="#"
                onClick={() => setOpen(false)}
                className="text-2xl font-semibold text-white transition-colors hover:text-mint"
              >
                {link}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
