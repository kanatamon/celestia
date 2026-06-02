// Gift Animation Tap — MAIN-world content script entry (ADR-0006).
// NOT registered in manifest.config.ts: crxjs would wrap it in an async loader
// that installs ~1s late (issue #65). Instead the `giftTapClassicInjection` build
// plugin bundles this file into a classic IIFE and registers it directly, so it
// patches the page globals synchronously at `document_start`, before TikTok's
// code runs. Has no `chrome.*`; bridges to the isolated relay via `window.postMessage`.
import { installGiftAnimationTap } from '@celestia/tiktok-live-chrome-extension';

installGiftAnimationTap();
