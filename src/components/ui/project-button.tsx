import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { useProjectTheme } from "@/contexts/ProjectThemeContext"
import { cn } from "@/lib/utils"

const projectButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "text-white shadow",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border bg-background hover:text-white shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:text-white",
        link: "underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ProjectButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof projectButtonVariants> {
  asChild?: boolean
  useProjectTheme?: boolean
}

// Helper to convert hex to HSL
const hexToHsl = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const ProjectButton = React.forwardRef<HTMLButtonElement, ProjectButtonProps>(
  ({ className, variant, size, asChild = false, useProjectTheme: useProjectThemeParam = true, style, ...props }, ref) => {
    const { themeColor, isUsingProjectTheme } = useProjectTheme();
    const Comp = asChild ? Slot : "button";

    // Only apply project theme for interactive variants when inside a project
    const shouldUseProjectTheme = useProjectThemeParam && isUsingProjectTheme && 
      (variant === 'default' || variant === 'outline' || variant === 'ghost');

    let dynamicStyle: React.CSSProperties = style || {};

    if (shouldUseProjectTheme && themeColor) {
      if (variant === 'default') {
        dynamicStyle = {
          ...style,
          backgroundColor: themeColor,
        };
      } else if (variant === 'outline') {
        dynamicStyle = {
          ...style,
          borderColor: themeColor,
          color: themeColor,
        };
      } else if (variant === 'ghost') {
        dynamicStyle = {
          ...style,
          color: themeColor,
        };
      }
    }

    const appliedClassName = shouldUseProjectTheme ? 
      cn(
        projectButtonVariants({ variant, size }),
        variant === 'default' && 'hover:opacity-90',
        variant === 'outline' && 'hover:bg-current hover:text-white hover:opacity-90',
        variant === 'ghost' && 'hover:bg-current hover:bg-opacity-20',
        className
      ) :
      cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        variant === 'default' && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === 'destructive' && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        variant === 'outline' && "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        variant === 'secondary' && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === 'ghost' && "hover:bg-accent hover:text-accent-foreground",
        variant === 'link' && "text-primary underline-offset-4 hover:underline",
        size === 'default' && "h-10 px-4 py-2",
        size === 'sm' && "h-9 rounded-md px-3",
        size === 'lg' && "h-11 rounded-md px-8",
        size === 'icon' && "h-10 w-10",
        className
      );

    return (
      <Comp
        className={appliedClassName}
        style={dynamicStyle}
        ref={ref}
        {...props}
      />
    )
  }
)
ProjectButton.displayName = "ProjectButton"

export { ProjectButton, projectButtonVariants }