import { Drawer, Flex, Menu, Typography } from 'antd';
import * as Icon from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { GlassModal } from '~/components/_ui/glass-modal';
import { FEED_SETTINGS } from '~/routes/live.$username.feed_';
import { useVersionInfo } from '../use-version-info';
import { useNavigationDrawerStore } from './navigation-drawer-store';

const { Text } = Typography;

export const NavigationDrawer = ({ username }: { username: string }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const { open, setOpen } = useNavigationDrawerStore();
	const versionInfo = useVersionInfo();

	const getSelectedKey = () => {
		if (location.pathname.includes('/feed')) {
			return 'live-feed';
		}
		if (location.pathname.includes('/dashboard')) {
			return 'dashboard';
		}
		return '';
	};

	return (
		<Drawer
			placement="left"
			onClose={() => setOpen(false)}
			open={open}
			width={256}
			styles={{
				body: {
					padding: 0,
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
				},
				footer: {
					padding: 0,
				},
			}}
			footer={
				<Menu
					mode="inline"
					items={[
						{
							key: 'leave',
							icon: <Icon.LogOut size={20} />,
							label: 'Leave',
							onClick: () => {
								navigate(`/`, { replace: true });
								setOpen(false);
							},
						},
					]}
					style={{
						background: 'transparent',
						boxShadow: 'none',
						backdropFilter: 'none',
					}}
				/>
			}
		>
			<Menu
				mode="inline"
				selectedKeys={[getSelectedKey()]}
				items={[
					{
						key: 'live-feed',
						icon: <Icon.Radio size={20} />,
						label: 'Live Feed',
						onClick: () => {
							navigate(`/live/${username}/feed/${FEED_SETTINGS[0]!.id}`, {
								replace: true,
							});
							setOpen(false);
						},
					},
					{
						key: 'dashboard',
						icon: <Icon.ChartNoAxesCombined size={20} />,
						label: 'Dashboard',
						onClick: () => {
							navigate(`/live/${username}/dashboard`, { replace: true });
							setOpen(false);
						},
					},
					{
						key: 'about',
						icon: <Icon.Info size={20} />,
						label: 'About',
						onClick: () => {
							GlassModal.info({
								title: 'About This Celestia',
								content: (
									<Flex vertical gap={4}>
										<Text style={{ color: 'currentcolor' }}>
											Version: {versionInfo.version}
										</Text>
										<Text style={{ color: 'currentcolor' }}>
											Build: {versionInfo.buildNumber}
										</Text>
										<Text style={{ color: 'currentcolor' }}>
											Commit: {versionInfo.git.shortCommit}
										</Text>
									</Flex>
								),
								onOk: () => setOpen(false),
							});
							setOpen(false);
						},
					},
				]}
				style={{
					background: 'transparent',
					boxShadow: 'none',
					backdropFilter: 'none',
				}}
			/>
		</Drawer>
	);
};
