"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-[#27272a]",
        orientation === "vertical" ? "w-[1px] h-4 self-center" : "h-[1px] w-full",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
