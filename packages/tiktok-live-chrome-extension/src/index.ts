export type { ProviderLog, Unsubscribe } from '@celestia/tiktok-live-core';
export {
	ChromeExtensionTikTokLiveProvider,
	createChromeExtensionTikTokLiveProvider,
} from './chrome-extension/chrome-extension-tiktok-live-provider.js';
export { installGiftAnimationTapRelay } from './chrome-extension/gift-animation-tap-isolated.js';
export { installGiftAnimationTap } from './chrome-extension/gift-animation-tap-main.js';
export {
	GIFT_ANIMATION_ASSET_CAPTURED,
	GIFT_ANIMATION_TAP_SOURCE,
	type GiftAnimationAssetCapturedMessage,
	type GiftAnimationTapBridgeMessage,
	isGiftAnimationAssetCapturedMessage,
	isGiftAnimationTapBridgeMessage,
} from './chrome-extension/gift-animation-tap-messages.js';
export {
	GIFT_ANIMATION_DECRYPT_KEY,
	GIFT_ANIMATION_MIME_TYPE,
	type GiftAssetArmState,
	type GiftAssetDecision,
	type GiftAssetFilterResult,
	type GiftAssetObservation,
	initialArmState,
	reduceGiftAssetFilter,
} from './chrome-extension/gift-asset-arm-filter.js';
export {
	type LiveIngestionTraceDocument,
	type LiveIngestionTraceEvent,
	liveIngestionTraceBuild,
	liveIngestionTraceSchema,
} from './chrome-extension/live-ingestion-trace.js';
export {
	type ConnectionClassificationSignals,
	classifyConnectionState,
} from './connection-classifier.js';
export { decodeWebcastFrame } from './protocol/decode-webcast-frame.js';
export { normalizeTikTokMessage } from './protocol/normalize-tiktok-message.js';
export type { ChromeConnectionState } from './types/chrome-connection-state.js';
