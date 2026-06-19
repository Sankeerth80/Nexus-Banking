import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-[premium-skeleton_1.4s_ease-in-out_infinite] rounded-md bg-muted bg-[linear-gradient(90deg,var(--muted),color-mix(in_oklch,var(--muted),var(--foreground)_7%),var(--muted))] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
