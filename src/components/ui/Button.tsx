import React from 'react';
import { cn } from '../../utils/cn'; // Assuming cn utility exists or I will create it. Actually I should check/create it.

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {

        const baseStyles = "inline-flex items-center justify-center font-medium font-sans uppercase tracking-widest transition-all duration-100 ease-linear focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-foreground disabled:opacity-50 disabled:pointer-events-none";

        const variants = {
            primary: "bg-foreground text-background hover:bg-background hover:text-foreground hover:ring-1 hover:ring-foreground border border-transparent hover:border-foreground",
            outline: "bg-transparent text-foreground border-2 border-foreground hover:bg-foreground hover:text-background",
            ghost: "bg-transparent text-foreground hover:underline p-0 h-auto",
        };

        const sizes = {
            sm: "h-9 px-4 text-xs",
            md: "h-11 px-8 text-sm",
            lg: "h-14 px-10 text-base",
        };

        // Ghost buttons don't need standard padding/height
        const sizeStyles = variant === 'ghost' ? '' : sizes[size];

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizeStyles,
                    fullWidth ? "w-full" : "",
                    className
                )}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";
