---
title: Speed run patterns
---

# Speed run patterns

## Goals

Speed Run Mode is an optional gameplay setting for local per-level timing.

It should stay small and app-layer owned until campaigns/categories need a deeper domain model.

## Scope

Current scope:

- Per-level Any% timing.
- Timer UI only when Speed Run Mode is enabled.
- Best times stored locally per tilemap id.
- Pause time does not count for Any%.

Out of scope for the current pattern:

- Full campaign runs.
- Online leaderboards.
- Replay validation.
- Category selection UI beyond Any%.

## Persistence

Settings and records use separate localStorage keys.

- `chibi.settings`: user preferences, including `speedRunMode`.
- `chibi.speedrun.records`: player best times.

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

Best times are keyed by `tilemap.id`, not scenario id.

Reason: the player-facing unit is the level. Scenario wrappers can launch the same tilemap and should not split records until they introduce meaningful modifiers.

Current category:

- `anyPercent`: reach the finish gate.

Future category metadata can use the same attempt fields:

- `pausedDuringRun` for No Pause.
- `enemyTotal` and `enemyKills` for All Enemies.

## Attempt lifecycle

Attempt state lives in `game.speedRun.attempt` and is transient.

Statuses:

- `idle`: no active timing because mode is off or no run is prepared.
- `ready`: level is reset and will start advancing once active gameplay updates.
- `running`: timer advances during active gameplay.
- `invalid`: attempt ended without a valid completion.
- `completed`: finish gate reached and Any% result was evaluated.

Prepare a fresh attempt when:

- gameplay starts from the start screen;
- the level restarts;
- the current tilemap switches while already playing;
- next level loads.

Do not start partial runs by merely enabling Speed Run Mode mid-level. Prepare from the next gameplay reset/start boundary.

## Timer advancement

Advance the timer only when gameplay updates:

```js
started && !paused && !player.dead && gameplaySession.outcome === 'active'
```

Pause time does not count. Opening pause marks `pausedDuringRun = true` for future categories but does not invalidate Any%.

Death invalidates the current attempt and never writes a best time.

Level switch or restart invalidates the previous attempt silently and prepares the next one.

## Completion

When the finish gate completes the gameplay session:

1. Stop the attempt.
2. Compare elapsed milliseconds against `anyPercent.bestMs` for the current tilemap.
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
- Show current attempt time.
- Show current level Best Any% or `Best --:--.---`.

Display format:

- Under one hour: `M:SS.mmm`.
- One hour or more: `H:MM:SS.mmm`.
- Missing best: `--:--.---`.

## Testing

Cover speedrun behavior at two levels:

- Module tests for settings normalization, record load/save, faster-best replacement, formatting, attempt completion.
- Browser tests for enabling Speed Run Mode through Settings and seeing the HUD timer during play.
