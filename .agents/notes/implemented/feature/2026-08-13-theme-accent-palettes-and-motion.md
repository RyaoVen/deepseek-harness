# Agent Note: Accent palettes and motion levels in the theme section

Status: implemented

English | [中文](2026-08-13-theme-accent-palettes-and-motion.zh.md)

## Problem

The Web GUI theme was one axis: `light`/`dark`/`system`, with the DeepSeek blue brand ramp the only accent and no way to control animation. "Multiple theme colors and motion" therefore meant either forking the token stylesheets or accepting the single ramp, and a user preferring no decorative motion had no product control at all.

## Decision

The durable `ui-theme` settings section grows two fields beside `preference`, both schema-defaulted so stored pre-upgrade sections keep working: `accent` (seven palettes — `deepseek`, `teal`, `violet`, `rose`, `amber`, `emerald`, `graphite`; `deepseek` is the shipped base ramp and the default) and `motion` (`standard`/`reduced`, default `standard`). ThemeRuntime owns both as snapshot fields with `setAccent`/`setMotion` writes through the same Host settings scope as `setTheme`; adopting a section that predates the fields falls back to the defaults instead of clearing the snapshot.

Projection stays presenter-owned: ui-layout's ThemePresenter writes `body[data-accent]` and `body[data-motion]` from the snapshot beside `data-ds-dark-theme`, and the host-rendered boot script sets the same three attributes pre-render so a non-default selection never flashes the base palette. `accents.css` redefines the whole `--dsw-static-deepseek-*` ramp per palette (light and dark blocks) — the alias layer already reads those steps, so one attribute recolors the product. `motion.css` collapses every animation/transition duration under `body[data-motion='reduced']` and `prefers-reduced-motion` (durations collapse rather than remove, so animation lifecycle events still fire) and exports the shared `dsw-fade-rise-in` keyframe; Modal's dialog uses it as its entrance.

The Appearance row grows an accent swatch row (seven labelled round swatches, preview colors as module-local literals — a swatch must show its palette regardless of the accent currently applied, so it cannot read the overridable tokens) and a two-cube motion control, all through the existing store-mirror sync.

## Alternatives considered

- **Accent as a registered third-party theme** (`ThemeRuntime.register` with alias-token overrides) — the existing extension point. Rejected: an accent recolors the whole brand ramp, which means overriding a dozen static-step tokens per palette; the registry contract is in-process extension semantics, not a durable product setting; and the Appearance row would need a second picker anyway.
- **Accent overrides in the alias layer only** — override `--dsw-alias-brand-*` and friends per accent instead of the static ramp. Rejected: the alias set referencing brand colors is wide and grows (buttons, bubbles, sidebar, state-business), so an alias-layer palette would silently miss new alias consumers, while the static ramp is exactly the set every alias reads.
- **Removing animations under `reduced`** (`animation: none`) — the usual shortcut. Rejected: removing breaks animation lifecycle events some components wait on; collapsing durations preserves them at effectively no motion.
- **Message-entrance animation on conversation rows** — the most visible motion candidate. Rejected for this change: conversation rows virtualize, so a pure-CSS entrance re-runs on every scroll remount; a correct version needs node-insertion gating in the render layer and belongs to its own change.

## Consequences

- One persisted attribute pair recolors the whole product and gates all decorative motion; both survive reloads via the boot script and `system`-independent of the color scheme.
- Six hand-tuned ramps ship in the token layer; a design-approved palette change edits `accents.css` alone.
- `prefers-reduced-motion` remains an independent floor: `standard` still collapses under the OS preference.
- The swatch preview literals are the one place outside the token sheets where palette colors are spelled; they are palette definitions, not feature styling.
- The durable section schema grew, so the settings seam now materializes `accent`/`motion` defaults on read; the Host-backed persistence boundary itself is unchanged ([[2026-08-06-host-backed-web-preferences]]).
