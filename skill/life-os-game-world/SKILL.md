---
name: life-os-game-world
description: Build a walkable 3D game world (memory palace) over someone's personal OS or project tool (Fibery, Notion, Airtable, Linear) with focus markers, scorecards and actionable quests.
---

# Life OS game world

Turn a person's goals, projects, tasks and metrics into a small 3D world they walk through: each life area is a themed building, each project a glowing pedestal, the most important work is marked like a game quest, and missions can be completed from inside the world. Reference implementation: the Happy Palace repo this skill ships in (`demo/index.html` is a working engine with example data; `fibery-app/` is the Fibery custom app version). Start from it rather than from scratch.

The idea behind the name "Happy Palace": a memory palace (remember by placing things in rooms you walk through) that is also a happy place (somewhere you want to return). Keep both halves: spatial, stable placement so things are easy to find, and a bright, personal world so opening it feels good.

The point is not decoration. The world must answer three questions at a glance: **where should I be, how healthy is each area, and what do I do next.** If a feature doesn't serve one of those, skip it.

## 0. Before building

Ask (one round, multiple choice where possible):
1. **Data source**: which tool holds their areas, projects, tasks, goals, metrics? (Fibery, Notion, Airtable, Linear, a spreadsheet, plain files)
2. **Where it should live**: inside their tool (Fibery custom app, Notion embed), as a Claude artifact reading a connector, or a static site.
3. **Time zone** for the day/night sky.
4. **What "focus" means for them**: a priority/score field, a ranked list, a goal slot (e.g. "MAX THREE"), or due dates.
5. **Personality**: 3 to 5 things that make the world theirs (places lived, a pet, favourite aesthetic). Optional: generate 2 to 4 panoramic concept images and let them pick an art direction before coding.

If they're time-poor, say so: a zero-code whiteboard version (areas as zones, projects as cards) is the 80/20; the 3D world is the fun 20%.

## 1. Discover the schema

- List databases/tables. Find these roles (names vary):
  - **Area** (life area, domain, department)
  - **Goal** (with a priority slot or rank)
  - **Project** (state, area, goal, open task count, next action, shipped/announced status)
  - **Task / mission** (state, project, due, priority, rank or score, blocked, delegate/assignee)
  - **Scorecard / metric** (score, status On track / At risk / Off / Stale, attainment %, target, latest value, trend)
  - **Agent** (optional: AI agents a task can be handed to)
  - **Idea** (optional: an inbox of ideas)
- Run one real read of each before writing code. Learn the result shape from real data, never guess.
- Note write paths you will need: set task state, set delegate. Check the user can and wants to write from the world.

## 2. Map data to the world

| Data | World object |
|---|---|
| Area | A wing around a central courtyard with a **themed landmark** (pick by keywords: health→garden, family/partner→cottage, money/finance→treasury, sales/offers→bazaar, marketing/social→amphitheatre, ops/admin→workshop, ventures→observatory, growth/learning→library, career/clients→guild hall, else→pavilion; no area→"attic") |
| Project | Pedestal + crystal inside its wing. Size = open tasks, colour = state, halo = shipped/announced, small figure = has a lead agent, red ring = no lead |
| Goal priority slots | Pillars in the central throne room; wing floor tint + gold walkway for the top slot |
| Tasks | Mission Board (drawer) and the quest card at each project |
| Scorecard per area | Sign at the wing entrance (score ring + metric bars), colour beam over the landmark (green ≥70, amber 40–69, red <40), metric columns (height = attainment, colour = status), flowers in proportion to score, ring on the minimap |
| Ideas | Fountain with one floating orb per idea |
| Shipped this week | A gate that lights up |

## 3. Focus: make attention obvious

This is the feature that makes it useful. Without it every project looks the same.
- **Top 3 focus projects** = the projects holding the highest-ranked open, unblocked tasks (use their own ranking field: execution score, priority, due date). Take the first 3 distinct projects in rank order.
- Mark them: gold pedestal, bigger glowing crystal, floating "!" quest marker, tall translucent light beam, label "Focus N".
- **Focus now panel** in the HUD: the 3 projects with each one's next task. Click = walk there.
- **Gold guide trail**: a row of glowing dots on the ground from the player to the selected focus project, animated forward. `G` cycles targets. Mark targets on the minimap.
- **Overdue**: pulsing red ring under the project + count in the label.
- **Quiet**: projects with no open tasks or in maintenance are smaller, translucent, greyed.

## 4. Quest card: act where you arrive

Walking up to a project opens a card with up to 6 open tasks, the top one marked ▶. Per task:
- **25-min sprint**: HUD countdown pinned to that task; also sets it In Progress. Confetti + "press Done" prompt at the end.
- **Done** (confetti; "Quest cleared" when it was the last open task), **Start**, **Hand to agent** (sets delegate), **Open** in the source tool.
- Keep the card open while the pointer is over it.
- After any write: refresh data and rebuild the world so focus re-ranks.
- Be honest in the UI: the world is a launcher, the real work happens elsewhere.

## 5. Build

**Stack**: Three.js r128 (cdnjs UMD build works in artifacts; npm `three@0.128.0` in Vite apps). One engine file + one data adapter + HUD markup + CSS. Keep the engine framework-free so the same source deploys anywhere; generate the variants from one source with a small script (see `tools/build_fibery_app.py`).

**Engine checklist**
- Sky dome ShaderMaterial gradient; time-of-day keyframes (top/bottom sky, sun colour/intensity, hemisphere light, night factor) lerped by the hour in the **user's time zone** via `Intl.DateTimeFormat(...,{timeZone})`, re-applied every 30 s. Stars, lamps, window glow and stage beams fade in at night; HUD switches light/dark with a `data-sky` attribute.
- Lighting: hemisphere + one shadow-casting directional light, PCF soft shadows, `shadow.bias ≈ -0.0004`, `normalBias ≈ 0.04`. **Scale daytime light down (×0.6)**: pale stone and sand blow out to white otherwise. Skip ACES tone mapping if the brief is "bright and happy" (it greys colours).
- Refinement: rounded boxes via `ExtrudeGeometry` with bevel, canvas textures (tiled floors, soft grass with low-contrast ellipses, striped awnings), InstancedMesh trees with per-instance colour, low hills ring, drifting clouds, flat-shaded crystals.
- Layout: compute each wing's footprint first; ring radius = max(44, Σ(width+12)/2π, 36+maxDepth/2). Keep the courtyard a fixed radius (~30) so a large workspace doesn't create an empty plaza. Narrow, low-contrast paths.
- Labels: canvas-texture sprites; truncate long names.
- Player + companion pet that trots behind; camera follows.
- Controls: WASD/arrows walk, Shift run, drag to turn, wheel zoom, **Q/E turn, R/F tilt, Z/X zoom, V view presets (Close/Follow/Aerial, tweened), H reset, G next focus, M missions**, click pedestal or minimap to travel, on-screen joystick on touch. Show the key legend in the HUD; tell users to click the world first so it gets key presses.
- Minimap canvas: wings, score rings, focus markers, player arrow.
- Example data first: render an "Example realm" (every name prefixed `Example:`) until live data arrives, then rebuild. Never ship the user's real data inside the page as sample data.
- Respect `prefers-reduced-motion`.
- CSS: any element toggled with the `hidden` attribute that also has `display:flex` needs `[hidden]{display:none}` or it never hides.

**Data adapter rules**
- One `query(q)` and one `write(action, input)` function; the engine never knows the backend.
- Load the main list first (it may trigger a consent prompt), then the rest in parallel with `Promise.allSettled` so one failing section doesn't blank the world.
- Decimal fields may come back as strings: `Number()` before maths.

## 6. Deploy targets

**Claude artifact (reads a connector)**
- Declare the `mcp` capability with only the tools used (e.g. Fibery `query`, `set_state`, `update_entities`). Load the artifact-capabilities skill first and read its type definitions.
- `await claude.use("mcp")` may be `null`: keep the example realm. Branch errors by code (`needs_reauth`, `server_not_connected`, `approval_required`, `tool_error`), never one generic banner. Read `result.payload`.
- The connector's query tool may accept inline literal values; the raw HTTP API usually needs `$params`.

**Fibery custom app (lives in the workspace, no consent prompts)**
- `create_custom_app` (kind `view`, in their space) → `create_custom_app_dev_token` (expires ~1 h; re-issue) → download sources → edit only `src/` (except platform-owned files), `index.html`, `package.json` → add `three` → `tsc --noEmit` + `vite build` locally → upload tarball (`--url-query description=...`, plain ASCII) → server build.
- Use `@/lib/fibery` (`queryEntities` with an aliased select map cast to the field type, `updateEntity`, `getWorkflowStates` to resolve state ids at runtime). Put `// @ts-nocheck` on the ported engine file.
- Workflow state: `{"workflow/state": {"fibery/id": <id from getWorkflowStates>}}`; single relation: `{"Space/Field": {"fibery/id": id}}`.
- It can't run outside Fibery (host history missing), so test the engine in the plain HTML build, then verify the live app in a real browser.

**Other tools**: same engine; swap the adapter (Notion API, Airtable API, a JSON export) and host as a static page or embed.

## 7. Test

- Playwright + Chromium with `--use-gl=swiftshader`; capture `pageerror`. Freeze the clock (`page.clock.install`) to test day and night.
- Headless WebGL is slow (dt clamps), so tweens and travel look unfinished in screenshots; judge motion in a real browser.
- Make a stress fixture with every area theme and many projects to catch builder exceptions and layout crowding.
- Known traps: `new THREE.CapsuleGeometry ? …` parses as a constructor call and crashes on r128 (Capsule doesn't exist before r139): use a cylinder. One thrown error in the world build kills the whole page; wrap risky builders.
- Verify one real write end to end before calling it done (mark a test task Done, confirm in the source tool).

## 8. Document and hand over

- Write a short wiki page set in their tool: overview (what exists, links, open items), the world (mapping, focus, scorecards, quest card, controls, data read, limits), and any automations.
- Give a next action that uses the world on real work: "Go to Focus 1, sprint on its top task, press Done."

## 9. Natural next step: wake agents

When a task's delegate is set, a database webhook (filtered in n8n or similar on the field actually changing, to avoid loops on your own writes) can trigger an agent that does the work and writes the result back onto the task. Check which of their agents accept inbound triggers before promising this; many consumer agents (scheduled desktop tasks, some proactive assistants) can't be woken by an API.
