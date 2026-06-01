// Gift Animation Tap — MAIN-world content script entry (ADR-0006).
// Registered with `world: 'MAIN'` at `document_start` so it patches the page
// globals before TikTok's code runs. Has no `chrome.*`; bridges to the isolated
// relay via `window.postMessage`.
import { installGiftAnimationTap } from '@celestia/tiktok-live-chrome-extension';

installGiftAnimationTap();
