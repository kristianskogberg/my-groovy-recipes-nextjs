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
          "border border-[hsl(var(--button-shadow))] bg-primary text-primary-foreground shadow-[0_3px_0_0_hsl(var(--button-shadow))] hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_4px_0_0_hsl(var(--button-shadow))] active:translate-y-[2px] active:shadow-[0_1px_0_0_hsl(var(--button-shadow))]",
        destructive:
          "border border-[hsl(var(--button-shadow))] bg-destructive text-destructive-foreground shadow-[0_3px_0_0_hsl(var(--button-shadow))] hover:-translate-y-px hover:bg-destructive/90 hover:shadow-[0_4px_0_0_hsl(var(--button-shadow))] active:translate-y-[2px] active:shadow-[0_1px_0_0_hsl(var(--button-shadow))]",
        outline:
          "border border-[hsl(var(--button-shadow))] bg-field text-field-foreground shadow-[0_3px_0_0_hsl(var(--button-shadow))] hover:-translate-y-px hover:bg-accent hover:text-accent-foreground hover:shadow-[0_4px_0_0_hsl(var(--button-shadow))] active:translate-y-[2px] active:shadow-[0_1px_0_0_hsl(var(--button-shadow))]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "",
        link: "text-secondary-foreground underline-offset-4 hover:underline",
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
  /** Show only the icon below the sm breakpoint, retaining the accessible text. */
  hideTextOnMobile?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, icon, hideTextOnMobile = false, children, ...props },
    ref,
  ) => {
    const iconElement = icon ? <span aria-hidden="true">{icon}</span> : null;
    const compact = hideTextOnMobile && Boolean(icon);
    const classes = cn(
      buttonVariants({ variant, size }),
      compact && "max-sm:gap-0 max-sm:px-2.5",
      className,
    );
    const renderLabel = (label: React.ReactNode) => compact
      ? <span className="sr-only sm:not-sr-only">{label}</span>
      : label;

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
      }>;

      return (
        <Slot
          className={classes}
          ref={ref}
          {...props}
        >
          {React.cloneElement(
            child,
            undefined,
            iconElement,
            renderLabel(child.props.children),
          )}
        </Slot>
      );
    }

    return (
      <button
        className={classes}
        ref={ref}
        {...props}
      >
        {iconElement}
        {renderLabel(children)}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
