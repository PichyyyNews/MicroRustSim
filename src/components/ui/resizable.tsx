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
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-1 items-center justify-center bg-border/60 hover:bg-zinc-600 transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-1 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90 cursor-col-resize aria-[orientation=horizontal]:cursor-row-resize select-none",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-1 shrink-0 rounded bg-zinc-500/50" />
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
