import { motion, AnimatePresence, type Variants } from 'framer-motion';

/**
 * Page transition variants for smooth navigation
 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

/**
 * Fade-only variant for subtle transitions
 */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Slide-up variant for modals/sheets
 */
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: { 
    opacity: 0, 
    y: 8,
    transition: { duration: 0.15 },
  },
};

export { motion, AnimatePresence };
