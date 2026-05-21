# Handoff: Platformer design reference redesign

Date: 2026-05-21
Workspace: `/home/manasseh/Git/platformer`

## Context

User wants to rework/redesign the design reference pages:

- `/design/hud.html`
- `/design/menus.html`

Goal: align them with the existing hint system visual language from `/design/hints.html`: minimal, clean, readable. Both HUD and menu may allow an accent color, but cleanliness/readability should win over flare.

No code changes were made in this session. This handoff captures the agreed design direction from the grilling session.

## Source files examined

- `design/hints.html` — current minimal target/reference language.
- `design/hud.html` — current HUD board; still has more glass/flared styling.
- `design/menus.html` — current menu board; includes decorative scene/hero styling.
- `styles/main.game.css` — production styles; contains runtime hint layer, HUD, and menu styling.
- `styles/ui-tokens.css` — shared UI tokens.
- `styles/ui-primitives.css` — shared primitives for screens, panels, buttons, focus, keycaps.

## Agreed decisions

1. **Scope for first pass**
   - Update only the design reference pages first: `design/hud.html` and `design/menus.html`.
   - Do **not** update production styles yet (`styles/main.game.css`, shared primitives) until the design contract is settled.

2. **Base visual system**
   - HUD/menu design boards should reuse the same basic palette logic as `design/hints.html`:
     - near-black background: `#080b11`
     - parchment text: `#fff6e8`
     - muted text via alpha variables rather than many separate colors
     - neutral page chrome unchanged
     - one optional accent color
   - Suggested local token direction:
     ```css
     --ui-bg: #080b11;
     --ui-text: #fff6e8;
     --ui-text-alpha: .72;
     --ui-muted-alpha: .52;
     --ui-line-alpha: .14;
     --ui-accent: #f4b51d;
     ```

3. **Accent usage**
   - Accent should be restrained.
   - Allowed for:
     - focus ring
     - selected/current item
     - primary action
     - a small meaningful structural marker
   - Not allowed for:
     - ambient glow clouds
     - decorative radial washes
     - tinted panels everywhere
     - excessive gradients

4. **HUD accent details**
   - Current HUD-style left accent border/inner outline is explicitly unwanted; it feels out of place.
   - No decorative vertical stripe, inner frame, or accent border on the HUD container.
   - Accent belongs inside meaningful content only, e.g. act badge, ready/important state, maybe timer/state emphasis.
   - Health/dash state can use semantic accent/status treatment, but container chrome should stay neutral.

5. **HUD structure**
   - HUD may be one subtle card, or separate micro-containers if that reads better.
   - Do not force everything into one container.
   - Subtle blur is allowed, but it should not be loud/in-your-face.
   - Preferred scan order:
     1. level / act identity
     2. health
     3. objective
     4. dash / skill state
     5. speedrun timer only when enabled
   - Rows/groups can be separated by spacing, faint lines, or quiet micro-surfaces.

6. **Menu direction so far**
   - Last active question was about whether to remove the illustrated/scene-like start screen preview (`hero-scene`, moon, runner, gate) or keep a simplified version.
   - Recommended answer given: remove it from the core menu language; favor typography + actions + concise metadata. If keeping world flavor, make it optional/minimal (small text/status strip), not decorative illustration.
   - User has **not yet answered** this question.

## Open next question

Ask the user one question at a time, continuing the grill-me flow:

> For menus, should the redesign remove the illustrated/scene-like start screen preview (`hero-scene`, moon, runner, gate), or keep a simplified version?
>
> Recommended answer: remove it from the core menu language. Use typography + actions + concise metadata; if any world flavor remains, make it a small text/status strip rather than a decorative illustration panel.

## Suggested skills

- `grill-me`: continue the one-question-at-a-time design interrogation before editing.
- `frontend-design`: use when implementing the redesigned `design/hud.html` and `design/menus.html`, since the work is visual/UI design.
- `frontend-behavior-testing`: only if later changes move into production UI and need Playwright/browser validation.

## Notes for next agent

- User prefers concise answers.
- If a question can be answered by reading the codebase, inspect files instead of asking.
- Current active task is still in decision-gathering mode, not implementation mode.
- No sensitive information appeared in the conversation.
