export type AttentionStatus = 'active' | 'hidden' | 'unfocused' | 'background';

export interface UserAttentionStatusListener {
	(state: AttentionStatus, previousState: AttentionStatus): void;
}

export interface UserAttentionState {
	isVisible: boolean;
	isFocused: boolean;
	isActive: boolean;
	status: AttentionStatus;
	timestamp: number;
}

export class UserAttentionManager {
	private static instance: UserAttentionManager;
	private listeners: Set<UserAttentionStatusListener> = new Set();
	private currentState: AttentionStatus = 'active';
	private isVisible: boolean = !document.hidden;
	private isFocused: boolean = document.hasFocus();

	private constructor() {
		this.init();
	}

	static getInstance(): UserAttentionManager {
		if (!UserAttentionManager.instance) {
			UserAttentionManager.instance = new UserAttentionManager();
		}
		return UserAttentionManager.instance;
	}

	private init(): void {
		// Page Visibility API
		document.addEventListener('visibilitychange', this.handleVisibilityChange);

		// Window Focus Events
		window.addEventListener('focus', this.handleFocus);
		window.addEventListener('blur', this.handleBlur);

		// Initial state calculation
		this.updateState();
	}

	private handleVisibilityChange = (): void => {
		this.isVisible = !document.hidden;
		this.updateState();
	};

	private handleFocus = (): void => {
		this.isFocused = true;
		this.updateState();
	};

	private handleBlur = (): void => {
		this.isFocused = false;
		this.updateState();
	};

	private calculateState(): AttentionStatus {
		if (this.isVisible && this.isFocused) return 'active';
		if (!this.isVisible) return 'hidden';
		if (this.isVisible && !this.isFocused) return 'unfocused';
		return 'background';
	}

	private updateState(): void {
		const previousState = this.currentState;
		const newState = this.calculateState();

		if (previousState !== newState) {
			this.currentState = newState;
			this.notifyListeners(newState, previousState);
		}
	}

	private notifyListeners(
		state: AttentionStatus,
		previousState: AttentionStatus,
	): void {
		this.listeners.forEach((listener) => {
			try {
				listener(state, previousState);
			} catch (error) {
				console.error('Error in TabStateManager listener:', error);
			}
		});
	}

	getState(): UserAttentionState {
		return {
			isVisible: this.isVisible,
			isFocused: this.isFocused,
			isActive: this.isVisible && this.isFocused,
			status: this.currentState,
			timestamp: Date.now(),
		};
	}

	subscribe(listener: UserAttentionStatusListener): () => void {
		this.listeners.add(listener);

		// Return unsubscribe function
		return () => {
			this.listeners.delete(listener);
		};
	}

	// Utility methods
	isActive(): boolean {
		return this.currentState === 'active';
	}

	isAway(): boolean {
		return this.currentState !== 'active';
	}

	// Cleanup (for testing or app shutdown)
	destroy(): void {
		document.removeEventListener(
			'visibilitychange',
			this.handleVisibilityChange,
		);
		window.removeEventListener('focus', this.handleFocus);
		window.removeEventListener('blur', this.handleBlur);
		this.listeners.clear();
	}
}

export const userAttentionManager = UserAttentionManager.getInstance();
