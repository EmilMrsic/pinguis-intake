"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  showValue?: boolean
  valueFormatter?: (n: number) => string
  haptic?: boolean
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, showValue = true, valueFormatter, haptic = false, step, onValueChange, onValueCommit, ...props }, ref) => {
  const isMounted = React.useRef(false)

  const initial = (() => {
    const fromValue = (props.value as number[] | undefined)?.[0]
    const fromDefault = (props.defaultValue as number[] | undefined)?.[0]
    const fromMin = (props.min as number | undefined) ?? 0
    return fromValue ?? fromDefault ?? fromMin
  })()

  const [liveValue, setLiveValue] = React.useState<number>(initial)
  const lastIntRef = React.useRef<number>(Math.floor(initial))
  const [dragging, setDragging] = React.useState<boolean>(false)

  // Keep internal live value in sync with controlled value
  React.useEffect(() => {
    const v = (props.value as number[] | undefined)?.[0]
    if (v !== undefined) setLiveValue(v)
  }, [(props.value as number[] | undefined)?.[0]])

  React.useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  React.useEffect(() => {
    lastIntRef.current = Math.floor(liveValue)
  }, [liveValue])

  const handleValueChange = React.useCallback((v: number[]) => {
    const n = v?.[0] ?? 0
    setLiveValue(n)

    if (haptic && typeof navigator !== "undefined" && typeof (navigator as any).vibrate === "function") {
      const nextInt = Math.floor(n)
      if (nextInt !== lastIntRef.current) {
        try { (navigator as any).vibrate(1) } catch {}
        lastIntRef.current = nextInt
      }
    }

    onValueChange?.(v)
  }, [haptic, onValueChange])

  const handleValueCommit = React.useCallback((v: number[]) => {
    // Briefly enable easing after release to avoid a hard stop feeling
    setDragging(false)
    onValueCommit?.(v)
  }, [onValueCommit])

  const formatted = (valueFormatter ?? ((n: number) => `${Math.round(n)}`))(liveValue)
  const stepFinal = step ?? 0.01

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "group relative flex w-full touch-none select-none items-center",
        className
      )}
      step={stepFinal}
      onValueChange={handleValueChange}
      onValueCommit={handleValueCommit}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow cursor-pointer overflow-hidden rounded-full bg-primary/20">
        <SliderPrimitive.Range className="absolute h-full bg-primary transition-[width] duration-100 ease-out" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        onPointerDown={() => setDragging(true)}
        className={cn(
          "relative block h-5 w-5 cursor-grab rounded-full border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          dragging ? "cursor-grabbing" : "transition-transform duration-100 ease-out will-change-transform",
          // larger forgiving hit area
          "before:absolute before:-inset-2 before:content-['']"
        )}
        aria-valuetext={formatted}
      >
        {showValue && (
          <div className={cn(
            "pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 select-none rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium leading-none text-primary-foreground shadow",
            dragging ? "opacity-100" : "opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
          )}>
            {formatted}
          </div>
        )}
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
