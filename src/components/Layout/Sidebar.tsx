import React from 'react';
import { cn } from '../../utils/cn';
import { Card } from '../ui/Card';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
}

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
    ({ className, title, icon, actions, children, ...props }, ref) => {
        return (
            <Card
                ref={ref}
                variant="standard"
                className={cn(
                    "flex-none md:flex-none w-full md:w-[450px] lg:w-[600px] md:border-l-4 border-foreground md:overflow-y-auto bg-background flex flex-col p-0",
                    className
                )}
                {...props}
            >
                {/* Header */}
                <div className="p-8 border-b border-foreground flex items-center justify-between sticky top-0 bg-background z-10">
                    <div className="flex items-center gap-3">
                        {icon && <span className="text-foreground">{icon}</span>}
                        {title && (
                            <h1 className="text-2xl font-display italic font-bold tracking-tight">
                                {title}
                            </h1>
                        )}
                    </div>
                    {actions && <div className="flex gap-2">{actions}</div>}
                </div>

                {/* Content */}
                <div className="flex-1 p-8 space-y-12">
                    {children}
                </div>
            </Card>
        );
    }
);

Sidebar.displayName = "Sidebar";

export const SidebarSection: React.FC<{
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ title, icon, children, className }) => (
    <div className={cn("space-y-6", className)}>
        <h3 className="flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-widest border-b border-gray-200 pb-2">
            {icon && React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
            {title}
        </h3>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);
