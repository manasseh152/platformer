# Gate capture mode for Launch Assets

Launch Asset screenshots should be captured from production-like built app routes, but capture setup can alter presentation state for deterministic screenshots. We chose to keep capture behavior route-based while activating it only when a `capture` query parameter is present and an explicit build/runtime flag such as `VITE_ENABLE_CAPTURE_MODE=true` allows it, so normal production deployments do not respond to capture URLs.
