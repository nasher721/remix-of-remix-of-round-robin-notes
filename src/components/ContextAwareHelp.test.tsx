import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { ContextAwareHelp } from './ContextAwareHelp';

describe('ContextAwareHelp', () => {
    it('renders the help button', () => {
        render(<ContextAwareHelp />);
        expect(screen.getByRole('button', { name: /get help/i })).toBeDefined();
    });

    it('opens the popover on click and shows dashboard help content by default on root route', () => {
        render(<ContextAwareHelp />, { initialEntries: ['/'] });
        const button = screen.getByRole('button', { name: /get help/i });
        fireEvent.click(button);

        expect(screen.getByText('Dashboard Help')).toBeDefined();
        expect(screen.getByText(/add patient:/i)).toBeDefined();
    });

    it('shows default help content on unknown routes', () => {
        render(<ContextAwareHelp />, { initialEntries: ['/unknown'] });
        const button = screen.getByRole('button', { name: /get help/i });
        fireEvent.click(button);

        expect(screen.getByText('Help & Tips')).toBeDefined();
        expect(screen.getByText(/welcome to round robin notes/i)).toBeDefined();
    });

    it('closes the popover when close button is clicked', async () => {
        render(<ContextAwareHelp />, { initialEntries: ['/unknown'] });
        const button = screen.getByRole('button', { name: /get help/i });
        fireEvent.click(button);

        expect(screen.getByText('Help & Tips')).toBeDefined();

        // Use a more specific selector if multiple close buttons exist, 
        // but here we only have one in the popover.
        const closeButton = screen.getByRole('button', { name: /close help/i });
        fireEvent.click(closeButton);

        // Wait for the popover to close (it might be async)
        // In many Radix components, the content is removed from DOM
        expect(screen.queryByText('Help & Tips')).toBeNull();
    });
});
