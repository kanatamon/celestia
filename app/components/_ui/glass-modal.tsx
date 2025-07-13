import { Modal as BaseModal, Flex, Space, Typography } from 'antd';
import * as Icon from 'lucide-react';
import { glassButtonStyles } from './glass-button';

const { Title } = Typography;

interface Options {
	title: React.ReactNode;
	content: React.ReactNode;
	onOk?: () => void;
	onCancel?: () => void;
	okText?: string;
	cancelText?: string;
	icon?: React.ReactNode;
	type?: 'info' | 'danger';
}

export const getDefaultStyles = () => ({
	content: {
		background:
			'linear-gradient(135deg, rgba(139, 92, 246, 0.75), rgba(59, 130, 246, 0))',
		borderRadius: '12px',
		padding: '6px 8px',
		backdropFilter: 'blur(5px)',
		border: '1px solid rgba(255, 255, 255, 0.1)',
	} satisfies React.CSSProperties,
});

export const getDangerStyles = () => ({
	content: {
		background:
			'linear-gradient(135deg, rgba(220, 38, 38, 0.75), rgba(185, 28, 28, 0))',
		borderRadius: '12px',
		padding: '6px 8px',
		backdropFilter: 'blur(5px)',
		border: '1px solid rgba(255, 255, 255, 0.1)',
	} satisfies React.CSSProperties,
});

const getIconBackground = (): React.CSSProperties => ({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '36px',
	height: '36px',
	borderRadius: '8px',
	background: 'rgba(255, 255, 255, 0.2)',
	backdropFilter: 'blur(10px)',
	color: 'rgba(255, 255, 255, 0.9)',
});

export class GlassModal {
	static confirm(options: Options) {
		const {
			title,
			content,
			onOk,
			onCancel,
			okText = 'Confirm',
			cancelText = 'Cancel',
			icon,
			type = 'danger',
		} = options;

		return BaseModal.confirm({
			title: null, // We'll handle title in content
			icon: null, // We'll handle icon in content
			content: (
				<Space align="start">
					<div style={getIconBackground()}>
						{icon || <Icon.CircleAlert size={20} />}
					</div>
					<Flex
						vertical
						gap={6}
						style={{
							color: 'rgba(255, 255, 255, 0.95)',
						}}
					>
						<Title
							level={3}
							style={{
								fontSize: '16px',
								margin: 0,
								color: 'currentcolor',
							}}
						>
							{title}
						</Title>
						<div style={{ color: 'currentcolor' }}>{content}</div>
					</Flex>
				</Space>
			),
			styles: getDangerStyles(),
			closable: false,
			cancelText,
			okText,
			onOk,
			onCancel,
			okButtonProps: {
				style: glassButtonStyles.default,
			},
			cancelButtonProps: {
				style: glassButtonStyles.default,
			},
		});
	}

	static info(options: Omit<Options, 'onCancel' | 'cancelText'>) {
		const { title, content, onOk, okText = 'OK' } = options;

		return BaseModal.info({
			title: null, // We'll handle title in content
			icon: null, // We'll handle icon in content
			content: (
				<Space align="start">
					<div style={getIconBackground()}>
						<Icon.Info size={20} />
					</div>
					<Flex
						vertical
						gap={6}
						style={{
							color: 'rgba(255, 255, 255, 0.95)',
						}}
					>
						<Title
							level={3}
							style={{
								fontSize: '16px',
								margin: 0,
								color: 'currentcolor',
							}}
						>
							{title}
						</Title>
						<div style={{ color: 'currentcolor' }}>{content}</div>
					</Flex>
				</Space>
			),
			styles: getDefaultStyles(),
			okText,
			onOk,
			okButtonProps: {
				style: glassButtonStyles.default,
			},
		});
	}
}
