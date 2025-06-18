import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoScrollOptions {
	threshold?: number; // How close to bottom counts as "at bottom" (default: 50px)
	behavior?: 'smooth' | 'instant'; // Scroll behavior
	dependencies?: any[]; // What triggers potential auto-scroll (like message count)
}

export const useAutoScroll = (options: UseAutoScrollOptions = {}) => {
	const { threshold = 50, behavior = 'smooth', dependencies = [] } = options;

	const scrollRef = useRef<HTMLDivElement>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	// Check if user is at the bottom of scroll container
	const checkIfAtBottom = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return false;

		const { scrollTop, scrollHeight, clientHeight } = element;

		// If the element doesn't need scrolling, consider it "at bottom"
		if (scrollHeight <= clientHeight) {
			return true;
		}

		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
		return distanceFromBottom <= threshold;
	}, [threshold]);

	// Scroll to bottom function
	const scrollToBottom = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;

		element.scrollTo({
			top: element.scrollHeight,
			behavior,
		});
	}, [behavior]);

	// Handle scroll events - detect if user scrolled away from bottom
	const handleScroll = useCallback(() => {
		const atBottom = checkIfAtBottom();
		setIsAtBottom(atBottom);

		// If user scrolled to bottom manually, re-enable auto scroll
		if (atBottom) {
			setShouldAutoScroll(true);
		} else {
			// User scrolled up to read old messages - disable auto scroll
			setShouldAutoScroll(false);
		}
	}, [checkIfAtBottom]);

	// Auto scroll when new messages arrive (if user was at bottom)
	useEffect(() => {
		if (shouldAutoScroll && isAtBottom) {
			// Small delay to ensure DOM has updated with new content
			const timeoutId = setTimeout(() => {
				scrollToBottom();
			}, 10);

			return () => clearTimeout(timeoutId);
		}
	}, [...dependencies, shouldAutoScroll, isAtBottom]);

	// Set up scroll listener
	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;

		element.addEventListener('scroll', handleScroll, { passive: true });

		// Initial check
		handleScroll();

		return () => {
			element.removeEventListener('scroll', handleScroll);
		};
	}, [handleScroll]);

	return {
		scrollRef,
		isAtBottom,
		shouldAutoScroll,
		scrollToBottom,
		// Manual controls
		enableAutoScroll: () => setShouldAutoScroll(true),
		disableAutoScroll: () => setShouldAutoScroll(false),
	};
};
