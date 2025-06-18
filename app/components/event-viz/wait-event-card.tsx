import { Typography } from 'antd';
import { LogIn } from 'lucide-react';

const { Text } = Typography;

export const WaitEventCard: React.FC<{
	style?: React.CSSProperties;
}> = ({ style = {} }) => {
	return (
		<div
			style={{
				padding: '6px 8px',
				borderRadius: '12px',
				background:
					'linear-gradient(135deg, rgba(59, 130, 246, 0.75), rgba(147, 51, 234, 0))',
				boxShadow: '0 4px 24px rgba(59, 130, 246, 0.1)',
				...style,
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				<div
					style={{
						width: '36px',
						height: '36px',
						borderRadius: '8px',
						background: 'rgba(59, 130, 246, 0.2)',
						backdropFilter: 'blur(20px)',
						border: '1px solid rgba(59, 130, 246, 0.3)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<LogIn
						size={20}
						style={{
							color: '#60a5fa',
						}}
					/>
				</div>
				<Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px' }}>
					Wait someone to join
				</Text>
			</div>
		</div>
	);
};
