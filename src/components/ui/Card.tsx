import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'standard' | 'inverted' | 'borderless';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'standard', children, ...props }, ref) => {

        const baseStyles = "transition-colors duration-100";

        const variants = {
            standard: "bg-background border border-foreground text-foreground p-6",
            inverted: "bg-foreground text-background p-6",
            borderless: "bg-transparent p-0",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = "Card";
