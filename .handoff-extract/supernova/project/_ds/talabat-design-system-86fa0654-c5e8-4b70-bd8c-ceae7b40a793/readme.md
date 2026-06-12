# talabat Design System

A brand & presentation design system for **talabat** — the leading on-demand
food & q-commerce delivery platform across the Middle East and North Africa.
This system captures talabat's bold, warm, playful visual language and packages
it as reusable tokens, components, foundation specimens, sample slides and a
full interactive deck so any agent can produce on-brand work fast.

> **Primary medium:** 16:9 slide presentations (1280×720). The brand's voice is
> loudest in decks — big orange surfaces, heavy Poppins headlines, organic
> blob "patches", outlined "stickers" and hand-drawn doodles.

---

## Sources

This system was built from an uploaded talabat slide-design kit:

- `tlb-slides (3).zip` — a `tlb-slides` skill bundle containing:
  - `SKILL.md` — the slide-generation brand spec (colours, fonts, rules).
  - `references/slide-patterns.md` — detailed per-layout specifications.
  - `assets/fonts/` — Poppins (Regular→Black), DM Sans (variable), Open Sans (variable).
  - `assets/logo/` — the talabat wordmark.
  - `assets/patches/`, `assets/stickers/`, `assets/icons/` (doodles), `assets/illustrations/` — brand graphics.
  - `assets/screenshots/template/` — ~73 reference renders of the official template (kept under `assets/screenshots/` for reference, not shipped).
- `install-tlb-slides (3).sh` — the bundle's installer (not used directly).

No Figma file or codebase was provided. If you have access to talabat's master
brand guidelines or component library, share them and this system can be made
even more precise.

---

## Brand at a glance

talabat is **warm, confident, fast and human**. The identity leans hard on a
single hero colour — Warm Orange — paired with a deep Sunset Brown for contrast,
a soft Off-White for breathing room, and a zingy Highlighter Green used *only*
for small accents. Everything feels a little hand-made and energetic:
imperfect organic shapes, a tilted logo, doodled line-art.

**Products represented:** the kit is presentation-focused (internal & external
decks, strategy reviews, partner pitches). The same visual language extends to
talabat's consumer app and marketing surfaces, but only the slide system was
provided here.

---

## Content fundamentals

How talabat writes copy in presentations and product:

- **Voice:** confident, plain-spoken, warm. Sounds like a person, not a brand
  team. Short sentences. Active voice.
- **Lead with the answer.** Slides state the conclusion first ("Demand keeps
  climbing"), then support it with *one or two* numbers — never a wall of stats.
- **"We" and "you".** talabat speaks as "we" (the team) and addresses the
  customer/partner as "you". Inclusive and direct.
- **Casing:** Display headlines are frequently **ALL CAPS** for punch
  (`WE ARE REAL`, `BUILT FOR THE REGION`). Titles and body use sentence case
  ("Market overview", "How it works"). Avoid Title Case.
- **Keyword emphasis:** one or two words per headline get a colour pop — orange
  on light surfaces, lime on orange/dark. Don't highlight whole phrases.
- **Numbers are characters.** Big stats (`12 min`, `+38%`) are set huge in
  DM Sans / Poppins as graphic elements, not buried in sentences.
- **Tone words:** real, fast, honest, effortless, together. Encouraging and a
  little cheeky ("Shout it out!").
- **Emoji:** not used. The brand expresses playfulness through *illustration
  and shape*, not emoji. Don't add them.
- **Punctuation:** minimal. Few exclamation marks, reserved for genuine
  enthusiasm. No corporate hedging ("we believe we may be able to…").

---

## Visual foundations

**Colour.** Orange dominates — it should cover 50%+ of most surfaces, and is the
brand. The core four: Warm Orange `#FF5900`, Sunset Brown `#411517` (copy &
dark surfaces), Off White `#F4EDE3` (default warm background), White `#FFFFFF`
(clean/chart surfaces). Highlighter Green `#CFFF00` is an accent **only** — tiny
details, keyword pops, sticker fills; never a background or body colour. Vivid
Purple `#8318D8` + Soft Lavender `#EBE8FC` are an approved *alternate* theme for
variety. A graduated Warm-Orange tint ramp (100→900) drives data-viz, org charts
and diagram fills. Imagery and graphics skew **warm** — saturated orange, no
cool/B&W treatment, no grain.

**Type.** Poppins is the primary typeface everywhere, run heavy for display
(ExtraBold/Black on covers, sections and statements) and Regular/Medium for
body. DM Sans is the secondary face, used mainly for oversized decorative
numerals (the big "1. 2. 3." and stat figures). Open Sans is reserved for dense
org charts and tables. Titles are **left-aligned** by default; display leading is
tight (0.84–0.95) so big lines hug each other. Slight negative letter-spacing on
the largest sizes.

**Backgrounds.** Mostly flat solid fills — orange, cream or burgundy — *not*
gradients, not photography-by-default. The interest comes from shape and type,
not texture. No repeating patterns; no blur/glass effects. Occasional full-bleed
food photography exists in the official template but the default is a confident
solid colour.

**Brand shapes.** Two signature devices:
- **Patches** — irregular, hand-made *filled* blobs (no border, no even radius).
  Used as number holders, bullets, or backdrops behind a word. They look
  slightly different each time on purpose.
- **Stickers** — *outlined* callout blobs carrying the burgundy stroke,
  sometimes with a speech-bubble tail. For short eye-catching bits: a discount,
  a stat, "New!".

**Illustration.** Hand-drawn, single-weight line doodles (bicycle, helmet, box,
phone, alarm, calendar, delivery ring) in burgundy, cream or lime. Loose and
imperfect — the charm is in the wobble. Used as small accents, never as dense
scene illustration.

**Logo.** The wordmark is always set slightly **tilted (~4.7°)** for a playful,
sticker-like feel. It sits top-right on content slides, bottom-right or large
on covers. Never recolour or straighten it beyond brand-approved placements.

**Layout.** Content slides carry a small **orange accent bar** pinned to the
top-left (≈154×12px, rounded bottom corners) and the tilted logo top-right.
Generous left margin (~56–64px). Titles top-left in orange; content fills below.

**Corners & cards.** Rectangles get soft, friendly radii (md ≈18px, lg ≈28px).
Clean white stat cards use an 18px radius and a *soft* burgundy-tinted shadow
(`0 8px 24px rgba(65,21,23,.10–.14)`) — shadows are used sparingly; the brand is
mostly flat. Patches and stickers are never rounded-rectangles.

**Motion / states.** Lively but restrained. Entrances are quick fades/rises with
a snappy ease-out (`cubic-bezier(.22,1,.36,1)`); no long or infinite loops.
Buttons darken their fill on **hover** and **squish slightly (scale .96)** on
press. No bounce-heavy or spring-overshoot animation on content.

**Transparency / blur.** Largely avoided. Occasional low-opacity burgundy
(e.g. faded repeated wordmark on the closer) for depth — never frosted glass.

---

## Iconography

talabat's "icon" vocabulary is **illustration-first**, not a utility icon set:

- **Hand-drawn doodles** (`assets/illustrations/`) are the primary iconographic
  language — single-weight line drawings of delivery objects (bicycle, helmet,
  box with arrows, phone, alarm clock, calendar, delivery ring) in burgundy,
  cream or lime. These are **PNG bitmaps**, copied into this system; reference
  them by `<img>`. Do not redraw them as SVG.
- **Flat two-tone food icons** appear in the official template's icon reference
  (filled food/category glyphs in orange + burgundy). ⚠️ These exist only inside
  a reference *screenshot* in the source kit, not as individual extractable
  files — so they are **not** shipped here as usable assets. If you need them,
  ask for the icon source files. As a stopgap, a filled icon set with a single
  accent (e.g. **Phosphor "fill"** or **Material Symbols rounded, filled**) is
  the closest CDN match — flag any such substitution to the user.
- **Bullets & markers** are simple filled dots, or numerals inside patches —
  not iconographic.
- **Emoji / unicode symbols:** not used as icons. Keep them out.

Because the brand expresses meaning through illustration and bold shape, prefer
a relevant doodle or a numbered patch over a generic UI glyph wherever possible.

---

## What's in this system (index)

**Root**
- `styles.css` — global entry point (import this one file). `@import`s all tokens & fonts.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills-compatible front-matter wrapper.

**Tokens** (`tokens/`)
- `colors.css` — brand core, accent, purple theme, neutrals, orange tint ramp + semantic aliases.
- `typography.css` — families, weights, slide type scale, line-heights, tracking.
- `spacing.css` — spacing scale, slide canvas, accent bar, logo, radii, shadows, motion.
- `fonts.css` — `@font-face` for Poppins, DM Sans, Open Sans.

**Assets** (`assets/`)
- `fonts/` — the three typeface families (TTF).
- `logo/talabat-logo.png` — the wordmark.
- `patches/` — organic filled blobs (orange / burgundy / cream).
- `stickers/` — outlined callout blobs (lime / orange, with & without tail).
- `illustrations/` — hand-drawn doodles (bicycle, helmet, box, phone, alarm, calendar, ring).
- `screenshots/template/` — reference renders of the official template (for guidance only).

**Components** (`components/`) — React primitives, exposed on `window.TalabatDesignSystem_86fa06`
- `AccentBar` — top-left orange slide tab.
- `Logo` — tilted wordmark.
- `Patch` — organic blob / number holder.
- `Sticker` — outlined callout blob.
- `Highlight` — inline keyword emphasis.
- `TwoToneTitle` — alternating-colour headline.
- `NumberedItem` — big-numeral list row.
- `Button` — brand CTA (primary / dark / lime / outline).

**Foundation cards** (`guidelines/`) — specimen cards shown in the Design System tab
(Colors, Type, Spacing, Brand).

**Sample slides** (`slides/`) — single-frame 1280×720 examples: cover, section
divider, statement, content, numbered list, agenda, thank-you.

**UI kit** (`ui_kits/presentation/`) — `index.html`: a full interactive talabat
deck (arrow keys / click to navigate, thumbnail rail, print-to-PDF) assembling
all the slide types.

**Starting points** (`starting-points/`) — seedable cover & content slides.

---

## Caveats

- **Fonts:** Poppins, DM Sans and Open Sans are the *actual* TTFs from the source
  kit — no substitution. (If talabat uses a bespoke licensed face anywhere, it
  was not in the bundle.)
- **Flat food icons** are not available as files (see Iconography). Doodle
  illustrations are the shipped iconographic assets.
- **No app/marketing UI kit:** only the slide system was provided. Building an
  app or website UI kit would require the relevant Figma or codebase.
