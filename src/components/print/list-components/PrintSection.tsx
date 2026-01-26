import { cleanInlineStyles } from '../utils';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface PrintSectionProps {
    title: string;
    content?: string;
    children?: React.ReactNode;
    fontSize: number;
    variant?: 'primary' | 'blue' | 'green' | 'violet' | 'amber';
    className?: string;
}

export const PrintSection = ({
    title,
    content,
    children,
    fontSize,
    variant = 'primary',
    className
}: PrintSectionProps) => {
    const styles = {
        primary: {
            border: "border-primary/40",
            header: "bg-primary",
            content: "bg-muted/20"
        },
        blue: {
            border: "border-blue-400",
            header: "bg-blue-500",
            content: "bg-blue-50"
        },
        green: {
            border: "border-green-400",
            header: "bg-green-500",
            content: "bg-green-50"
        },
        violet: {
            border: "border-violet-400",
            header: "bg-violet-500",
            content: "bg-violet-50"
        },
        amber: {
            border: "border-amber-400",
            header: "bg-amber-500",
            content: "bg-amber-50"
        }
    };

    const style = styles[variant];

    return (
        <div className={cn("border-2 rounded-lg overflow-hidden", style.border, className)}>
            <div
                className={cn("text-white font-bold uppercase px-3 py-2", style.header)}
                style={{ fontSize: `${fontSize + 1}px`, letterSpacing: '0.5px' }}
            >
                {title}
            </div>
            {content ? (
                <div
                    className={cn("p-3", style.content)}
                    style={{ fontSize: `${fontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(content) || '<span class="text-muted-foreground italic">None documented</span>' }}
                />
            ) : (
                <div className={cn("p-3", style.content)}>
                    {children}
                </div>
            )}
        </div>
    );
};
