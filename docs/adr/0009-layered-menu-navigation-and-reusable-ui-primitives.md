# Layered menu navigation and reusable UI primitives

Settings and menu UI had mouse-first gaps: tab rails were not first-class semantic navigation layers, Controls nested tabs were click-only, and reusable tab/section/row helpers lived inline in Settings. We chose explicit layered semantic navigation for Settings, app-wide design-system primitives for tabs/sections/rows, and shared native/browser back handling across game and editor while preserving browser-native `Tab` behavior. Current UI and navigation guidance lives in [`../patterns/settings-and-ui.md`](../patterns/settings-and-ui.md).
