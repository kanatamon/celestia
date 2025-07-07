import { Button, Flex } from 'antd';
import * as Icon from 'lucide-react';
import { useNavigationDrawerStore } from './navigation-drawer-store';

export const NavigationMenu = ({ children }: { children: React.ReactNode }) => {
	const { setOpen } = useNavigationDrawerStore();
	return (
		<Flex
			gap={8}
			style={{
				padding: '16px',
			}}
		>
			<Button icon={<Icon.Menu />} type="text" onClick={() => setOpen(true)} />
			<div
				style={{
					marginLeft: 'auto',
				}}
			>
				{children}
			</div>
		</Flex>
	);
};
