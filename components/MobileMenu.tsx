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
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/75 hover:border-shop_light_green hover:text-shop_light_green hoverEffect lg:hidden"
          aria-label="Ouvrir le menu"
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
