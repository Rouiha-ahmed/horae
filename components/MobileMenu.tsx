"use client"
import { AlignLeft } from 'lucide-react'
import React, { useState } from 'react'
import SideMenu from './SideMenu'
import type { StorefrontLink, StorefrontSocialLink } from '@/lib/storefront'
import type { Category } from '@/types'

interface MobileMenuProps {
  links: StorefrontLink[];
  categories: Category[];
  socialLinks: StorefrontSocialLink[];
  pathnameOverride?: string;
}

const MobileMenu = ({ links, categories, socialLinks, pathnameOverride }: MobileMenuProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)  
  return (
    <>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-shop_light_green/35 bg-white/90 text-lightColor shadow-[0_10px_22px_-18px_rgba(22,46,110,0.5)] hover:border-shop_light_green hover:text-shop_dark_green hoverEffect lg:hidden"
        >
            <AlignLeft className='h-4.5 w-4.5'/>
        </button>
        <div className='lg:hidden'>
            <SideMenu
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                links={links}
                categories={categories}
                socialLinks={socialLinks}
                pathnameOverride={pathnameOverride}
            />
        </div>
    </>
  )
}

export default MobileMenu
