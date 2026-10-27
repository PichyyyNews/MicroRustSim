import * as React from "react"
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

interface ResizableHandleProps extends ResizablePrimitive.SeparatorProps {
  withHandle?: boolean
  orientation?: "horizontal" | "vertical"
}

function ResizableHandle({
  withHandle = true,
  orientation,
  className,
  ...props
}: ResizableHandleProps) {
  const isHorizontal = orientation === "horizontal"

  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex items-center justify-center transition-colors select-none z-10 group bg-transparent hover:bg-zinc-700/20",
        // Vertical divider (default between left/right panels)
        !isHorizontal && "w-1 h-full cursor-col-resize",
        // Horizontal divider (between top/bottom panels)
        isHorizontal && "w-full h-1 cursor-row-resize",
        className
      )}
      {...props}
    >
      {/* 1px visual divider line */}
      <div
        className={cn(
          "handle-line absolute bg-[#222226] group-hover:bg-zinc-400/80 transition-colors pointer-events-none",
          isHorizontal ? "inset-x-0 h-px w-full" : "inset-y-0 w-px h-full"
        )}
      />

      {/* Grip Indicator: Horizontal pill for horizontal bar, Vertical pill for vertical bar */}
      {withHandle && (
        <div
          className={cn(
            "handle-grip z-10 rounded-full bg-zinc-600/80 group-hover:bg-zinc-300 transition-colors pointer-events-none",
            isHorizontal ? "h-[2px] w-6" : "w-[2px] h-3.5"
          )}
        />
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
