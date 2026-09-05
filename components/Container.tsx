import { cn } from '@/lib/utils'
import React from 'react'

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

const Container = ({ children, className, ...props }: ContainerProps) => {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-5 md:px-8 lg:px-10", className)} {...props}>
      {children}
    </div>
  )
}


export default Container
