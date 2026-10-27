import { cn } from "@/lib/utils"
import * as ResizablePrimitive from "react-resizable-panels"

function ResizablePanelGroup({
  className,
  orientation,
  direction,
  ...props
}: ResizablePrimitive.GroupProps & { direction?: "horizontal" | "vertical" }) {
  const actualOrientation = orientation || direction || "horizontal"
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      orientation={actualOrientation}
      className={cn(
        "flex h-full w-full",
        actualOrientation === "vertical" ? "flex-col" : "flex-row",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle = true,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex items-center justify-center transition-colors select-none z-10 group",
        "w-1 bg-transparent hover:bg-zinc-700/30 cursor-col-resize",
        "aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:h-1 aria-[orientation=horizontal]:cursor-row-resize",
        className
      )}
      {...props}
    >
      {/* 1px visual divider line in center */}
      <div className="absolute inset-y-0 w-px bg-[#222226] group-hover:bg-zinc-400/80 transition-colors aria-[orientation=horizontal]:hidden" />
      <div className="absolute inset-x-0 h-px bg-[#222226] group-hover:bg-zinc-400/80 transition-colors hidden aria-[orientation=horizontal]:block" />

      {withHandle && (
        <div className="z-10 flex h-3.5 w-[2px] rounded-full bg-zinc-600/80 group-hover:bg-zinc-300 transition-colors aria-[orientation=horizontal]:h-[2px] aria-[orientation=horizontal]:w-3.5" />
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
