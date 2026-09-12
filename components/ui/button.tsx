import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold transition-[color,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-foreground bg-primary text-primary-foreground shadow-[0_3px_0_0_hsl(var(--foreground))] hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_4px_0_0_hsl(var(--foreground))] active:translate-y-[2px] active:shadow-[0_1px_0_0_hsl(var(--foreground))]",
        destructive:
          "border border-foreground bg-destructive text-destructive-foreground shadow-[0_3px_0_0_hsl(var(--foreground))] hover:-translate-y-px hover:bg-destructive/90 hover:shadow-[0_4px_0_0_hsl(var(--foreground))] active:translate-y-[2px] active:shadow-[0_1px_0_0_hsl(var(--foreground))]",
        outline:
          "border border-foreground bg-white text-foreground shadow-[0_3px_0_0_hsl(var(--foreground))] hover:-translate-y-px hover:text-accent-foreground hover:shadow-[0_4px_0_0_hsl(var(--foreground))] active:translate-y-[2px] active:shadow-[0_1px_0_0_hsl(var(--foreground))]",
        secondary:
          "bg-white text-secondary-foreground shadow-sm hover:bg-white/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, icon, children, ...props },
    ref,
  ) => {
    const iconElement = icon ? <span aria-hidden="true">{icon}</span> : null;

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
      }>;

      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {React.cloneElement(
            child,
            undefined,
            iconElement,
            child.props.children,
          )}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {iconElement}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
