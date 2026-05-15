# tiktok-live-core as a separate package from the Chrome extension

The `TikTokLiveProvider` interface and `LiveEvent` types live in `@celestia/tiktok-live-core`, not inside `@celestia/tiktok-live-chrome-extension`. This means the Side Panel React UI and `@celestia/ui` components import from a platform-agnostic types package — they have no dependency on Chrome APIs.

With only one Provider in v1.0.0, the separation isn't required by current usage. It's recorded here because the alternative — collapsing types into the Chrome extension package — was explicitly considered and rejected: the UI importing from a package named `tiktok-live-chrome-extension` would leak platform coupling into the view layer, and the cost of maintaining a thin types package is negligible.
