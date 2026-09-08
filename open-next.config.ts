// OpenNext Cloudflare adapter for the public Next.js intake (prescope-intake).
// Dummy cache is enough for this SSR/dynamic form. Optional R2 ISR cache:
// https://opennext.js.org/cloudflare/caching
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  // incrementalCache: r2IncrementalCache,
});
