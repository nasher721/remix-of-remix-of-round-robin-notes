import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

/**
 * Hook to detect user's motion preference
 * Respects system preference and localStorage override
 */
export function useMotionPreference() {
  const prefersReducedMotion = useReducedMotion();
  
  const motionPreference = useMemo(() => {
    // Check for localStorage override
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('motion-preference');
      if (stored === 'reduced') return 'reduced';
      if (stored === 'enabled') return 'enabled';
    }
    // Fall back to system preference
    return prefersReducedMotion ? 'reduced' : 'enabled';
  }, [prefersReducedMotion]);
  
  return {
    prefersReducedMotion: motionPreference === 'reduced',
    setPreference: (pref: 'reduced' | 'enabled' | 'system') => {
      if (typeof window !== 'undefined') {
        if (pref === 'system') {
          localStorage.removeItem('motion-preference');
        } else {
          localStorage.setItem('motion-preference', pref);
        }
        // Trigger re-render by forcing update
        window.dispatchEvent(new Event('motion-preference-change'));
      }
    },
  };
}

/**
 * Motion-enabled component that respects reduced-motion preferences
 * Use this instead of motion.div for automatic reduced-motion support
 */
interface MotionDivProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children?: React.ReactNode;
  className?: string;
  /** Custom reduced-motion variant */
  reducedVariant?: "none" | "fade";
}

export function MotionDiv({ 
  children, 
  className,
  reducedVariant = "none",
  ...props 
}: MotionDivProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion && reducedVariant === "none") {
    return <div className={className}>{children}</div>;
  }
  
  if (prefersReducedMotion && reducedVariant === "fade") {
    return (
      <motion.div 
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
  
  return (
    <motion.div className={className} {...props}>
      {children}
    </motion.div>
  );
}

/**
 * Fade-in component with reduced-motion support built-in
 */
interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in seconds */
  delay?: number;
  /** Duration in seconds */
  duration?: number;
}

export function FadeIn({ 
  children, 
  className, 
  delay = 0,
  duration = 0.3,
}: FadeInProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered list animation with reduced-motion support
 */
interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay between items */
  stagger?: number;
}

export function Stagger({ 
  children, 
  className, 
  stagger = 0.05,
}: StaggerProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Individual stagger item
 */
interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { type: 'spring', stiffness: 300, damping: 25 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scale-in animation with reduced-motion fallback
 */
interface ScaleInProps {
  children: React.ReactNode;
  className?: string;
}

export function ScaleIn({ children, className }: ScaleInProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Slide-in from direction with reduced-motion fallback
 */
interface SlideInProps {
  children: React.ReactNode;
  className?: string;
  direction?: "left" | "right" | "up" | "down";
}

export function SlideIn({ children, className, direction = "up" }: SlideInProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const directionMap = {
    left: { x: -20, y: 0 },
    right: { x: 20, y: 0 },
    up: { x: 0, y: -20 },
    down: { x: 0, y: 20 },
  };
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}
