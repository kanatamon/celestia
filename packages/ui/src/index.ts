export type { ActivitySwitcherProps, ActivitySwitcherView } from './activity-switcher.js';
export { ActivitySwitcher } from './activity-switcher.js';
export type { CelebrationEvent, CelebrationQueueState } from './celebration-queue.js';
export {
	CELEBRATION_QUEUE_WAITING_CAP,
	initialCelebrationQueueState,
	reduceCelebrationQueue,
} from './celebration-queue.js';
export type {
	CelebrationSettings,
	CelebrationSettingsStorage,
	CelebrationThresholdTier,
	CreateCelebrationSettingsOptions,
} from './celebration-settings.js';
export {
	CELEBRATION_THRESHOLD_DEFAULT,
	CELEBRATION_THRESHOLD_MAX,
	CELEBRATION_THRESHOLD_MIN,
	CELEBRATION_THRESHOLD_TIERS,
	celebrationSettings,
	configureCelebrationSettingsStorage,
	createCelebrationSettings,
	normalizeThreshold,
} from './celebration-settings.js';
export type {
	AnimatedCapturedCelebration,
	CapturedCelebration,
	CelebrationStageProps,
	SynthesizedCapturedCelebration,
} from './celebration-stage.js';
export { CelebrationStage } from './celebration-stage.js';
export type {
	ChatEventCardProps,
	EventFeedProps,
	FeedEventCardProps,
	FeedLiveEvent,
	GiftEventCardProps,
	IndividualChatFeedProps,
	ScrollableFeedListProps,
	SplitFeedLayoutProps,
} from './event-feed.js';
export {
	ChatEventCard,
	EventFeed,
	FeedEventCard,
	GiftEventCard,
	IndividualChatFeed,
	ScrollableFeedList,
	SplitFeedLayout,
} from './event-feed.js';
export type {
	BlastPreset,
	BurstOrigin,
	FireworksDrawContext,
	FireworksEngineOptions,
	FireworksParticle,
	GlowSprite,
	GlowSpriteSheet,
} from './fireworks.js';
export {
	createGlowSpriteSheet,
	FIREWORKS_BEAT_MS,
	FIREWORKS_BURST_HEIGHT_FRACTION,
	FIREWORKS_BURST_OFFSET_MS,
	FireworksEngine,
	MEGA_BLAST,
} from './fireworks.js';
export type { GiftCelebrationProps } from './gift-celebration.js';
export { GiftCelebration } from './gift-celebration.js';
export type {
	GiftCelebrationFit,
	GiftCelebrationPaneLayout,
	GiftCelebrationTriptychLayout,
	GiftCelebrationViewport,
} from './gift-celebration-layout.js';
export {
	computeGiftCelebrationTriptychLayout,
	getGiftCelebrationSourceAspectRatio,
} from './gift-celebration-layout.js';
export { CelestiaProvider } from './provider.js';
export type { SettingsPopoverProps } from './settings-popover.js';
export { SettingsPopover } from './settings-popover.js';
export type {
	Channel,
	CreateSoundManagerOptions,
	SoundManager,
	SoundManagerStorage,
	VolumeKey,
} from './sound-manager.js';
export { configureSoundManagerStorage, createSoundManager, soundManager } from './sound-manager.js';
export type { StatusBarProps } from './status-bar.js';
export { StatusBar } from './status-bar.js';
export type {
	CelestiaProviderProps,
	CelestiaSemanticTokenCssVariables,
	CelestiaSemanticTokens,
} from './theme.js';
export {
	celestiaSemanticTokenCssVariables,
	celestiaSemanticTokens,
	celestiaThemeConfig,
} from './theme.js';
export { useSoundEffects } from './use-sound-effects.js';
