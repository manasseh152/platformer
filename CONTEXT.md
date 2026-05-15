# Chibi Knight Platformer

This context describes the shared game/product language for the Chibi Knight platformer. It separates player-facing/domain concepts from implementation patterns and historical architecture decisions.

## Language

**Game Context**:
The single bounded context for the platformer product and its authoring/validation workflows.
_Avoid_: Source package, architecture layer, module boundary

**Scenario**:
A launchable game entry that starts one or more runtime scenes, usually backed by a tilemap.
_Avoid_: Level, map, tilemap

**Tilemap**:
An authored spatial layout made from tile layers and placed assets for a gameplay scenario.
_Avoid_: Scene, level, map, tilemap scene, core scene

## Relationships

- The **Game Context** contains the shared language used by gameplay, content authoring, validation fixtures, runtime UI, and editor workflows.
- A **Scenario** starts one or more runtime scenes.
- A **Scenario** may reference one **Tilemap**.
- A **Tilemap** is consumed by gameplay but is not itself launchable.

## Example dialogue

> **Dev:** "Is Movement Gym a tilemap?"
> **Domain expert:** "No — Movement Gym is a **Scenario**. It may reference a **Tilemap**, but the scenario is the launchable entry."

> **Dev:** "Should we call the authored grid a core scene?"
> **Domain expert:** "No — it is a **Tilemap**: tile layers and placed assets, similar to a Godot tilemap. Runtime scene terminology belongs elsewhere."

> **Dev:** "Should `src/content` and `src/core` each get their own bounded context?"
> **Domain expert:** "No — those are implementation packages inside the same **Game Context**. Use package docs for ownership, and use `CONTEXT.md` for shared game language."

## Flagged ambiguities

- "context" can mean a DDD bounded context or an implementation/runtime context object — resolved: **Game Context** means the single DDD bounded context; implementation contexts should be named more specifically.
- "level", "map", and "tilemap" were used for launchable entries — resolved: **Scenario** is the canonical launchable entry; user-facing UI may still say “Level Select”.
- "tilemap" was mixed with scene terminology — resolved: **Tilemap** means authored tile layers and placed assets, not a runtime scene or core scene.
- "scene" is runtime implementation language, not domain language — resolved: keep **Scene** definitions in pattern docs, not as canonical domain terms in this context.
