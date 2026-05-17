---
title: Speed run patterns
---

# Speed run patterns

Shared domain language lives in [`../../CONTEXT.md`](../../CONTEXT.md). This pattern doc covers the implementation rules for **Speed Run Mode**, **Attempts**, and **Local Records**.

## Goals

Speed Run Mode is optional product behavior for timing scenario completion and saving current-device best results.

It should stay small and app-layer owned until campaigns/categories need a deeper implementation model.

## Scope

Current scope:

- Per-scenario Any% timing.
- Timer UI only when Speed Run Mode is enabled.
- Local Records stored on the current device.
- Pause time does not count for Any%.

Out of scope for the current pattern:

- Full campaign runs.
- Online leaderboards.
- Replay validation.
- Category selection UI beyond Any%.

## Persistence

Settings and records use separate localStorage keys.

- `chibi.settings`: user preferences, including `speedRunMode`.
- `chibi.speedrun.records`: Local Records.

Records are not part of raw app settings export/import.

Record shape:

```js
{
  schemaVersion: 1,
  records: {
    'act-01-level-1': {
      anyPercent: {
        bestMs: 12345,
        completedAt: '2026-05-07T...'
      }
    }
  }
}
```

Store integer milliseconds. Format display values from stored numbers.

## Identity and categories

Local Records are currently keyed by `tilemap.id`, not scenario id.

Reason: current campaign scenarios map one-to-one to player-facing tilemaps. Scenario wrappers can launch the same tilemap and should not split records until they introduce meaningful modifiers. If scenarios gain distinct modifiers for the same tilemap, revisit this keying rule.

Current category:

- `anyPercent`: reach the finish gate.

Future category metadata can use the same Attempt fields:

- `pausedDuringRun` for No Pause.
- `enemyTotal` and `enemyKills` for All Enemies.

## Attempt lifecycle

Attempt state lives in `game.speedRun.attempt` and is transient.

Statuses:

- `idle`: no active timing because mode is off or no Attempt is prepared.
- `ready`: gameplay is reset and will start advancing once active gameplay updates.
- `running`: timer advances during active gameplay.
- `invalid`: attempt ended without a valid completion.
- `completed`: finish gate reached and Any% result was evaluated.

Prepare a fresh attempt when:

- gameplay starts from the start screen;
- the scenario restarts;
- the current tilemap switches while already playing;
- the next scenario loads.

Do not start partial Attempts by merely enabling Speed Run Mode mid-session. Prepare from the next gameplay reset/start boundary.

## Timer advancement

Advance the timer only when gameplay updates:

```js
started && !paused && !player.dead && gameplaySession.outcome === 'active'
```

Pause time does not count. Opening pause marks `pausedDuringRun = true` for future categories but does not invalidate Any%.

Death invalidates the current Attempt and never writes a Local Record.

Scenario switch or restart invalidates the previous Attempt silently and prepares the next one.

## Completion

When the finish gate completes the gameplay session:

1. Stop the attempt.
2. Compare elapsed milliseconds against `anyPercent.bestMs` for the current Local Record key.
3. Save only if the time is faster or no best exists.
4. Keep the result in `game.speedRun.lastResult` for the victory toast.

The victory toast may show:

- `Speed Run: 0:42.381 — New Best!`
- `Speed Run: 0:44.901 — Best 0:42.381`

If Speed Run Mode is off, hide speedrun result UI entirely.

## UI

Settings:

- Category: Gameplay.
- Toggle: Speed Run Mode.
- Action: Clear Speed Run Records.

HUD:

- Visible only when Speed Run Mode is enabled.
- Show current Attempt time.
- Show current scenario Best Any% or `Best --:--.---`.

Display format:

- Under one hour: `M:SS.mmm`.
- One hour or more: `H:MM:SS.mmm`.
- Missing best: `--:--.---`.

## Testing

Cover speedrun behavior at two levels:

- Module tests for settings normalization, record load/save, faster-best replacement, formatting, attempt completion.
- Browser tests for enabling Speed Run Mode through Settings and seeing the HUD timer during play.
