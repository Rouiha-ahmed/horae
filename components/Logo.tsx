import Link from 'next/link'
import React from 'react'

const Logo = () => {
  return (
    <Link
      href={"/"}
      aria-label="HORAE — accueil"
      className="group inline-flex items-center gap-2.5 text-current"
    >
      <span className="text-[1.05rem] font-medium leading-none tracking-[-0.045em] sm:text-[1.12rem]">
        HORAE
      </span>
      <span className="hidden h-px w-6 bg-shop_light_green/80 transition-all duration-300 group-hover:w-9 sm:block" />
    </Link>
  )
}

export default Logo
