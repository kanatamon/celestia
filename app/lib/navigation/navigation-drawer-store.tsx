import { create } from 'zustand';

interface NavigationDrawerStore {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
}

export const useNavigationDrawerStore = create<NavigationDrawerStore>(
	(set) => ({
		open: false,
		setOpen: (open) => set({ open }),
		toggle: () => set((state) => ({ open: !state.open })),
	}),
);
