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

**Placed Asset**:
A tilemap-authored decoration, marker, or gameplay-relevant placement interpreted during a gameplay session.
_Avoid_: Runtime entity, scene object

**Solid Layer**:
A tilemap layer whose occupied tile cells define solid ground, walls, and other static surfaces.
_Avoid_: Terrain, collision layer, collision rects, build terrain, terrain primitives, autotile artifacts

**Hazard**:
A tilemap-authored or runtime gameplay element that harms or defeats the player on contact.
_Avoid_: Enemy

**Enemy**:
A non-player gameplay character that can oppose, obstruct, or harm the player during a gameplay session.
_Avoid_: NPC, mob, hazard

**Player**:
The controllable hero character in a gameplay session.
_Avoid_: Actor, character, avatar, hero

**Goal**:
The condition that completes a scenario.
_Avoid_: Win condition, objective

**Finish Gate**:
A placed asset that completes the scenario when reached by the player.
_Avoid_: Exit, portal, goal tile

**Speed Run Mode**:
A play mode that times scenario completion and records local best results.
_Avoid_: Timer mode, time trial

**Attempt**:
One timed try at completing a scenario in Speed Run Mode.
_Avoid_: Run, gameplay session

**Local Record**:
The best completed speedrun result saved on the current device for a scenario.
_Avoid_: High score, leaderboard entry, save data

**Developer Mode**:
A mode that exposes developer-only scenarios, tools, and diagnostics.
_Avoid_: Debug mode, admin mode, devtools

**Map Editor**:
The browser tool for authoring tilemaps and saving local drafts.
_Avoid_: Level editor

**Installed App**:
The browser-installed form of Chibi Hollow that prioritizes playing scenarios and authoring tilemaps.
_Avoid_: Website shortcut, native app

**Launch Assets**:
Generated screenshots, install assets, and review images used to prepare Chibi Hollow for distribution and release validation.
_Avoid_: PWA assets, marketing assets, CI screenshots

**Layer**:
A tilemap authoring plane for one kind of content, such as terrain, entities, decor, or lights.
_Avoid_: Canvas layer, render layer

**Brush**:
The selected tile, marker, or asset stamped into a tilemap layer.
_Avoid_: Pack item, tool

**Brush Palette**:
The Map Editor picker for browsing, previewing, and selecting brushes.
_Avoid_: Pack wheel, brush HUD

**Tile Cell**:
An authored grid position in a tilemap layer that stores a brush identity or is empty.
_Avoid_: Tile object, metadata blob

**Compiled Tile Instance**:
A normalized tile cell produced from authored tilemap data for gameplay, rendering, collision, or effects processing.
_Avoid_: Authored tile, saved cell

**Brush Definition**:
A reusable description of what a brush stamps into a tile cell, including its stable identity and gameplay, visual, or effect traits.
_Avoid_: Runtime tile id, random tile uuid

**Brush Trait**:
A gameplay, visual, or effect capability declared by a brush definition and interpreted during tilemap compilation.
_Avoid_: Hard-coded tile type, editor-only flag

**Material**:
A reusable visual family for tile cells, such as grass or stone, that can define how neighboring cells visually connect.
_Avoid_: Terrain kind, brush id, asset id

**Gameplay Session**:
One active playthrough of a scenario from start until completion, failure, restart, or exit.
_Avoid_: Run, attempt, level instance

**Scenario Source**:
A category of scenarios grouped by purpose and origin.
_Avoid_: Level type, map type

**Campaign**:
A player-facing progression scenario set.
_Avoid_: Act source, story level group

**Act**:
A player-facing campaign chapter that groups progression scenarios.
_Avoid_: Category, tab, world

**Gym**:
A developer validation scenario for a specific mechanic or system.
_Avoid_: Test level, fixture map

**Machine**:
A gym-owned validation controller that drives, pins, or observes gameplay systems and reports pass/fail state.
_Avoid_: Bot, test script, smoke test

**Zoo**:
A developer demonstration scenario showing examples or variants without necessarily being CI-gated.
_Avoid_: Gallery level, sample map

**Local Draft**:
A same-device editor-authored tilemap draft that can be exposed as a local scenario.
_Avoid_: Local level, saved map

**Draft Schema Version**:
The version marker used to migrate saved local tilemap drafts when authored tilemap structure changes.
_Avoid_: Save version, app version

**Hazard**:
A damaging environmental placement in a tilemap, separate from actor spawns and goals.
_Avoid_: Entity, enemy, terrain

**Spike**:
A hazard that damages the player on contact.
_Avoid_: Enemy, decor, terrain

**Multi-size Authoring Grid**:
A tilemap authoring capability where a placement layer can support more than one cell size for different hazards or items.
_Avoid_: Dynamic grid, variable grid

## Relationships

- The **Game Context** contains the shared language used by gameplay, content authoring, validation fixtures, runtime UI, and editor workflows.
- A **Scenario** starts one or more runtime scenes.
- A **Scenario** may reference one **Tilemap**.
- A **Tilemap** is consumed by gameplay but is not itself launchable.
- A **Tilemap** contains **Layers**, including a default **Solid Layer**, and **Placed Assets** but does not own runtime behavior.
- A **Tilemap** may contain hazard **Placed Assets**.
- An enemy is not a **Hazard**, but it may cause hazardous contact during a **Gameplay Session**.
- A **Tilemap** may contain enemy spawn **Placed Assets**.
- **Placed Assets** remain distinct from brush-trait **Tile Cells** in the current slice; they may be bridged into the brush pipeline later.
- A **Gameplay Session** owns active **Enemies** and their runtime behavior.
- A **Gameplay Session** has exactly one **Player** for now.
- A **Tilemap** must provide a player start **Placed Asset**.
- A **Scenario** has one **Goal**.
- A **Finish Gate** is a **Placed Asset**.
- A **Gameplay Session** evaluates **Goal** completion.
- An **Attempt** occurs within one **Gameplay Session**.
- A completed **Attempt** may produce or update a **Local Record**.
- A **Local Record** belongs to the timed **Scenario** identity; current implementation may key records by tilemap while scenarios are one-to-one with tilemaps.
- **Gyms** and **Zoos** are visible in **Developer Mode**.
- **Developer Mode** does not change player-facing campaign rules.
- The **Map Editor** authors **Tilemaps**.
- The **Installed App** launches the player-facing game by default and includes the **Map Editor** for local authoring.
- The **Installed App** should be usable offline for core gameplay and local tilemap authoring.
- The **Installed App** does not own **Local Draft** persistence; drafts remain owned by the **Map Editor** workflow.
- The **Installed App** should apply updates on next launch rather than interrupting an active **Gameplay Session** or **Map Editor** workflow.
- The **Installed App** should prioritize an immersive landscape presentation while preserving in-app navigation for authoring workflows.
- **Launch Assets** include **Installed App** icons, store screenshots, link-preview images, and visual review artifacts.
- **Launch Assets** are generated for release preparation and validated for required coverage and freshness.
- A **Tilemap** contains one or more creator-defined **Layers**.
- A **Brush** is applied to a **Layer**.
- A **Brush** may constrain which **Layers** it can be applied to.
- A **Layer** contains and owns the visual ordering of its **Tile Cells**.
- A **Tile Cell** stores one **Brush** identity or is empty.
- A **Brush Definition** describes what a **Brush** stamps into **Tile Cells**.
- A **Brush Definition** declares one or more **Brush Traits**.
- A visual **Brush Trait** may reference a **Material**.
- **Material** connectivity is based on material identity, not brush identity.
- Authored **Tilemaps** optimize for stable, readable brush identities; compiled tilemap data optimizes for runtime performance.
- A **Compiled Tile Instance** is derived from a **Tile Cell** during tilemap compilation.
- A **Brush Palette** selects the active **Brush** for the **Map Editor**.
- Saving in the **Map Editor** creates or updates a **Local Draft**.
- A **Local Draft** has a **Draft Schema Version**.
- Play Preview starts a temporary **Gameplay Session** without creating a durable **Scenario**.
- Saving local exposes the **Local Draft** as a local **Scenario**.
- A **Scenario** creates a new **Gameplay Session** each time it is started or restarted.
- **Campaigns**, **Gyms**, **Zoos**, and **Local Drafts** are **Scenario Sources**.
- A **Gym** defines one or more **Machines**.
- A **Machine** validates behavior during a **Gameplay Session**.
- A **Campaign** contains one or more **Acts**.
- An **Act** contains one or more campaign **Scenarios**.
- A **Local Draft** may be exposed as a local **Scenario**.
- A **Tilemap** may contain **Hazards**.
- A **Hazard** may be authored as a brush-trait **Tile Cell**.
- A **Hazard** is authored separately from **Placed Assets** for precise placement.
- A **Spike** is a kind of **Hazard**; the first authored spikes are floor-facing, with orientation expected later.

## Example dialogue

> **Dev:** "Is Movement Gym a tilemap?"
> **Domain expert:** "No — Movement Gym is a **Scenario**. It may reference a **Tilemap**, but the scenario is the launchable entry."

> **Dev:** "Should we call the authored grid a core scene?"
> **Domain expert:** "No — it is a **Tilemap**: tile layers and placed assets, similar to a Godot tilemap. Runtime scene terminology belongs elsewhere."

> **Dev:** "Does a slime in a tilemap include AI state?"
> **Domain expert:** "No — the tilemap contains a **Placed Asset** such as an enemy spawn marker. Runtime behavior belongs to the **Gameplay Session**."

> **Dev:** "Is an 8px collision primitive a solid layer?"
> **Domain expert:** "No — a **Solid Layer** is authored solid ground and walls. Collision primitives are implementation artifacts derived from it."

> **Dev:** "Is a slime a hazard?"
> **Domain expert:** "No — a slime is an **Enemy**. It may cause hazardous contact, but **Hazard** is reserved for harmful elements such as spikes, lava, or fail zones."

> **Dev:** "Is the player start marker the player?"
> **Domain expert:** "No — the marker is a **Placed Asset** in the **Tilemap**. The **Player** exists during the **Gameplay Session**."

> **Dev:** "Is every goal a finish gate?"
> **Domain expert:** "No — a **Goal** is the scenario completion condition. A **Finish Gate** is the current placed-asset form of that goal."

> **Dev:** "Is every gameplay session an attempt?"
> **Domain expert:** "No — an **Attempt** is specifically a timed try in **Speed Run Mode**. Normal play still creates a **Gameplay Session**."

> **Dev:** "Is a failed speedrun attempt a local record?"
> **Domain expert:** "No — only a completed **Attempt** can produce or update a **Local Record**."

> **Dev:** "Does CI running gyms mean CI is in Developer Mode?"
> **Domain expert:** "No — **Developer Mode** is an interactive product mode. CI may run gym scenarios without enabling developer UI."

> **Dev:** "Does Play Preview create a local scenario?"
> **Domain expert:** "No — Play Preview starts a temporary **Gameplay Session**. Saving local creates a **Local Draft** that can be exposed as a local **Scenario**."

> **Dev:** "Is the Starter pack part of the game domain?"
> **Domain expert:** "No — asset packs are editor UI organization. Creators talk about **Layers**, **Brushes**, and the **Brush Palette** when authoring a **Tilemap**."

> **Dev:** "Does pausing and unpausing create a new gameplay session?"
> **Domain expert:** "No — a **Gameplay Session** lasts from scenario start until completion, failure, restart, or exit."

> **Dev:** "Is Movement Gym a source or a scenario?"
> **Domain expert:** "Movement Gym is a **Scenario** from the **Gym** scenario source."

> **Dev:** "Is a browser navigation smoke test a gym machine?"
> **Domain expert:** "No — a **Machine** validates in-engine behavior inside a **Gym**. Browser shell checks are ordinary smoke tests."

> **Dev:** "Is Act 1 just a UI tab?"
> **Domain expert:** "No — an **Act** is a campaign chapter. The UI may show acts as tabs, but the term is about campaign structure."

> **Dev:** "Are PWA icons and store screenshots just CI screenshots?"
> **Domain expert:** "No — they are **Launch Assets**: generated release-preparation outputs for presentation, installation, and review."

> **Dev:** "Should `src/content` and `src/core` each get their own bounded context?"
> **Domain expert:** "No — those are implementation packages inside the same **Game Context**. Use package docs for ownership, and use `CONTEXT.md` for shared game language."

## Future language candidates

- An explicit installed-app update prompt may become a player-facing concept later, but is not part of the current product language.

## Flagged ambiguities

- "context" can mean a DDD bounded context or an implementation/runtime context object — resolved: **Game Context** means the single DDD bounded context; implementation contexts should be named more specifically.
- "level", "map", and "tilemap" were used for launchable entries — resolved: **Scenario** is the canonical launchable entry; user-facing UI may still say “Level Select”.
- "tilemap" was mixed with scene terminology — resolved: **Tilemap** means authored tile layers and placed assets, not a runtime scene or core scene.
- "scene" is runtime implementation language, not domain language — resolved: keep **Scene** definitions in pattern docs, not as canonical domain terms in this context.
- "collision" is a technical mechanism, not domain language — resolved: describe player-facing authored behavior as **Solid Layer**, solid surfaces, or hazards; keep collision primitives/rects/AABBs in pattern docs.
- "entity" is overloaded across DDD, ECS, gameplay, and editor layers — resolved: avoid **Entity** as domain language; prefer **Player**, **Enemy**, **Placed Asset**, **Hazard**, or **Finish Gate**.
- "object" is overloaded between JavaScript objects, scene objects, and authored placements — resolved: avoid **Object** as domain language; prefer **Placed Asset** in creator-facing prose and reserve `defineObject()`/scene object for implementation docs.
- "catalog" is application/registry implementation language, not domain language — resolved: use **Scenario**, **Scenario Source**, **Campaign**, **Gym**, **Zoo**, and **Local Draft** for domain discussion.
- "runtime", "app", "render", "input", and "settings" name implementation or UI areas, not domain language for this context — resolved: keep them in pattern docs unless a product-specific term emerges.
- "PWA" is implementation/platform language — resolved: use **Installed App** for the player-facing installed product capability.
- "mode" is too broad as a generic domain term — resolved: define named product modes such as **Developer Mode** and **Speed Run Mode**, but avoid a generic **Mode** abstraction.
- "light" is currently rendering/content implementation language, not domain language — resolved: keep light primitives in rendering patterns until lights become creator-facing tilemap authoring concepts.
- "dynamic layer" was used ambiguously for configurable authoring, derived outputs, and runtime mutation — resolved: current scope is configurable authored **Layers** plus derived outputs; runtime-mutable layers are a later slice.
- "terrain" is legacy language for authored solid ground and walls — resolved: use **Solid Layer** for the default solid tile-cell layer so editor language and the generalized layer system stay aligned. Legacy code/data aliases may exist for one migration slice only.
- "entities" is legacy language for authored object placements — resolved: use **Placed Assets** and the canonical `placedAssets` layer for new authored data.
