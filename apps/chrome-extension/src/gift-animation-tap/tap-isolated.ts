// Gift Animation Tap — isolated-world content script entry (ADR-0006).
// Runs in the default isolated world (has `chrome.runtime`); relays captured
// bytes from the MAIN-world tap to the service worker.
import { installGiftAnimationTapRelay } from '@celestia/tiktok-live-chrome-extension';

installGiftAnimationTapRelay();
