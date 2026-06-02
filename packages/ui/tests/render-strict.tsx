import { act, type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// React's act() warns unless this flag is set. Every test module that drives a
// real root needs it, so the shared helper owns it.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A mounted React tree that always renders under `<StrictMode>`.
 *
 * The Session Tab renders the live UI under `<StrictMode>`
 * (`apps/chrome-extension/src/session-tab/main.tsx`), which double-invokes
 * render, state updaters, and mount-only effects in dev to surface impure side
 * effects. Component tests that mount with a bare `createRoot(...).render(...)`
 * never exercise that double-invoke, so a class of impurity bug (e.g. a
 * `setState` updater that revokes an object URL it just stored) passes in CI but
 * breaks in the real app. Mounting through this helper closes that gap.
 *
 * Each `render` / `unmount` is wrapped in `act(...)`, matching the dominant
 * synchronous pattern in this suite. Tests that need async flushing (timers,
 * resolved promises) can still drive the same `root` via their own
 * `await act(async () => ...)` calls.
 */
export interface StrictRoot {
	readonly container: HTMLDivElement;
	render(element: ReactNode): void;
	unmount(): void;
}

export function createStrictRoot(): StrictRoot {
	const container = document.createElement('div');
	const root = createRoot(container);

	return {
		container,
		render(element: ReactNode) {
			act(() => {
				root.render(<StrictMode>{element}</StrictMode>);
			});
		},
		unmount() {
			act(() => {
				root.unmount();
			});
		},
	};
}
