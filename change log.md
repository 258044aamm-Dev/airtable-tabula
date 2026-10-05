# Changelog

All notable changes to **Airtable Tabula** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.24] - 2026-10-05

Follow-up to v0.1.23. Two of the three reported issues were still wrong, and one turned out to be a pre-existing defect that v0.1.23 had merely made visible. Verified first that v0.1.23 was genuinely installed and its rules present in the shipped stylesheet, so none of these are stale-cache symptoms.

### Fixed
- **The mobile toolbar no longer clips its controls.** The mobile primary row is 328px wide at a 390px viewport, but the controls need 374px once the Delete button appears. The search field was `flex: 1 1 0` with no minimum, so it absorbed the whole deficit and collapsed to a 58px magnifier-only pill while "+ Field" and "More" fell off the right edge. The row now wraps, and the search has a 120px floor so it can never collapse. Measured: no control overflows and the search is never squashed, at 320, 360, 390 and 430px, both with and without a selection.

  This overflow was **not** caused by the Delete button. With nothing selected the row already overflowed and "More" was already clipped; Delete only made an existing defect obvious. The toolbar is now verified at four widths instead of assumed.
- **A focused cell now shows a single outline.** v0.1.23 removed the border *recolour* but left the 2px `box-shadow` ring, and that ring is itself a second rounded outline, so the cell still rendered two concentric radii. The capsule's own border is now the only focus cue: it turns terracotta and nothing else is drawn. The same treatment is applied to the search field, select triggers and the long-text editor.
- **Two inputs were still under 16px on mobile, so iOS would still zoom on them.** `tabula-longtext-input` inherited 13px and the inline header-rename input was 11px; the v0.1.23 rule had listed only four input classes and missed both. All nine focusable inputs the plugin can render are now verified at 16px or more on a 390px viewport, including the option-manager row inputs. Desktop keeps the reference's 12px.

### Not changed
- The 120px gap between stacked tables is unchanged, by request. It is the empty band visible above the keyboard on a multi-table file, but it is the designed spacing rather than a defect.

### Test harness
- The focus guard was inverted to match the new design and now asserts both halves of "exactly one outline": the focused cell draws no outer ring, *and* its border carries the accent.
- A new guard injects the Delete button into the real mobile toolbar and asserts nothing overflows and the search is not squashed, at four viewport widths.
- The 16px guard was widened to four inputs, and the long-text and header-rename editors were added to the harness (outside the grid wrap, so the frozen-column geometry checks are unaffected).

Build clean; functest reports ALL CHECKS PASSED; 0 of 24 controls repainted in both themes.

## [0.1.23] - 2026-10-05

Three issues reported from a real device: no delete action when rows are checked, two outlines on a focused cell, and a tapped cell filling half the screen on mobile. The first is a new feature; the other two are CSS.

### Added
- **Bulk delete.** Checking rows now reveals a `Delete (n)` button in the toolbar, between `+ Row` and `+ Field`, labelled with the number of checked rows. It is rendered only while a selection exists, so the toolbar returns to exactly the reference layout the moment the selection is cleared. It opens a confirmation naming the table and the row count, and the delete runs as a single pass: the Airtable `recordMap` entries are removed, the rows are filtered out, the selected and checked id sets are pruned, and the selection clears. It uses a custom dialog rather than `window.confirm()`, which Obsidian's mobile WebView does not support. The per-row right-click "Delete row" menu item is unchanged.

### Fixed
- **A focused cell no longer shows two outlines.** `input.tabula-cell-input:focus` was recolouring the capsule border to the accent *and* drawing a 2px outer ring, both at the cell's 16px radius, which read as two concentric rounded borders. The border now returns to its normal colour and the ring is the only focus cue. The same treatment is applied to the search field and select triggers so all three behave identically. The reference defines no focus styling at all, so this treatment is the plugin's own; the earlier decision to keep the native focus ring rather than tint the row is unchanged.
- **Tapping a cell no longer fills half the screen on mobile.** Inputs are now 16px on phones. iOS zooms the page on focus for any input whose computed font-size is under 16px, which is what made a tapped cell jump. Desktop keeps the reference's 12px.

### Fixed (regression from v0.1.22)
- **The mobile touch-target overrides were dead.** Rescoping the control rules to `.tabula-view .tabula-mount .tabula-file-root <element>.<class>` in v0.1.22 raised them to (0,4,1), which outranks the (0,2,0) overrides in the `max-width: 720px` block, so the mobile font-size bump never applied. Every media-query override targeting a control was audited for this; the affected ones are repaired and the touch targets, row heights and 36px drag handle are verified intact at 390px.

### Test harness
- `functest.py` was validating a **stale copy** of the stylesheet (`harness/styles.css`, a v0.1.21 snapshot) rather than the file being shipped, and its markup lacked the `.tabula-view` / `.tabula-mount` ancestor chain, so after the v0.1.22 rescoping no control rule matched there at all. Its "ALL CHECKS PASSED" was real but was not testing the current CSS. It now links `../repo/styles.css` directly, the stale copy has been deleted so it cannot drift again, the real ancestor chain is present, and a genuine `<input type="text">` cell was added so focus is testable.
- Two regression guards added: a focused cell's border must not be the accent colour, and every input must compute to at least 16px at a 390px viewport.

## [0.1.22] - 2026-10-05

Colour fix for the blue-purple cells, search box and buttons reported on a real device. The palette was never wrong: Obsidian's own base stylesheet was repainting the table's form controls on top of it.

### Fixed
- **Cells, "+ New row", the search box and toolbar buttons are no longer Obsidian's blue-purple.** Obsidian ships rules like `.view-content input[type=text]:not(.checkbox)` and `.view-content button` that paint every input and button inside a view with the theme's interactive colours. Those selectors outranked the plugin's single-class rules, so the controls were repainted while every non-control element (a `<div>`) kept the correct warm palette. That is why the header capsule, grid and row-number band looked right while the cells did not.
- Two things were needed, because neither alone was sufficient:
  - **The variables Obsidian reads are remapped on the plugin root.** `--interactive-normal`, `--interactive-hover`, `--text-normal` and `--background-modifier-border` are redefined on `.tabula-file-root` to point at the table's own tokens. This cannot be outranked by any selector, so the palette holds even if Obsidian's rule wins. It also corrects the cell and search **text** colour, which was likewise being overridden.
  - **Every form-control rule is now scoped to `.tabula-view .tabula-mount .tabula-file-root <element>.<class>`.** These are the plugin's real ancestor classes (`TableView.ts` sets `.tabula-view` and `.tabula-mount`). The scoping raises specificity above Obsidian's, so controls that deliberately differ from the default surface — the terracotta primary button, transparent drag handles, rating stars, icon buttons, the search field's stronger border, select options, the create-option row and the inline header rename — keep their own colours instead of falling back to the generic one.
- 35 selector blocks were rescoped. Rules that style something *inside* a control (for example the pill within a select option) are unchanged; they were never competing with Obsidian.

### Not changed
- No `!important` was introduced; the fix is specificity and variable scoping only.
- The settings tab renders outside the plugin view and uses no plugin classes, so it is unaffected.
- Focus rings keep the native Obsidian focus ring, as previously decided. `--interactive-accent` was deliberately left alone so focus behaviour is unchanged.

### Verified
`obsidian-scope-test.py` reproduces Obsidian's base rules verbatim, injects them **after** the plugin stylesheet (the worst case for source order), and asserts that no control changes computed background, colour or border in either theme. It covers all 17 control classes; the 7 that only exist behind a closed dropdown or a rename state are synthesised from the real TSX markup so none can ship unverified. Result: 0 of 24 controls repainted, light and dark. The functional suite still reports `ALL CHECKS PASSED`, including the row-highlight regression guard and the frozen-column sticky checks, and the plugin builds clean.

## [0.1.21] - 2026-10-05

Layout fixes for problems reported on a real device. v0.1.20 claimed these were fixed after measuring against a harness that did not reproduce the real component tree; it omitted `.tabula-file-table` and `.tabula-grid-area` and gave its pane no fixed height, so those measurements were meaningless. The verifier is now built on the real tree.

### Fixed
- **The empty space under "+ New row" is gone.** The single-table card was forced to `height: 100%` with `flex: 1 1 auto` at every level of the chain, so a short table left a large empty area inside the card. The card now sizes to its content; a tall table still scrolls inside the grid box.
- **The table gained 16px per side.** `.tabula-grid-area` added `16px` horizontal padding (8px on mobile) on top of the file root's page margin, a second horizontal inset that had not been accounted for. Removed, so the card's own border is the frame. "+ New row" keeps its 16px side margins.
- Mobile column widths are deliberately unchanged: a 160px minimum per column, so a wide table scrolls sideways on a phone.

### Verified
Rebuilt verifier mirrors the real tree and pins the pane to the viewport height the way Obsidian does. After the fix: card height no longer varies with pane height, empty space inside the grid box drops from 151px to 2px, horizontal dead space drops from 72px to 56px per side (48px of which is the Obsidian pane padding plus the file root's page margin, both kept on purpose). Reference spec diff unchanged at 58/59 in light and 55/59 in dark, the remainder the labelled card-padding deviation and the dark status-pill question.

## [0.1.20] - 2026-10-05

Rebuilds the table view against the warm terracotta `Anthropic Table Workspace` reference, replacing the indigo chrome introduced in v0.1.19. This release does touch TSX: a row-select column and a rating score were added, and the frozen-column bands were re-pointed to make room.

### Added
- **Row-select column.** A 32px checkbox band is now the leftmost column, with a select-all checkbox in the header and a per-row checkbox in each body row. The header checkbox shows an indeterminate state when only some visible rows are checked, and "select all" respects the active search and filters. Selection is view-only state held in `TableApp` and is never written to the document, so it cannot affect persisted data or Airtable sync. Ids for deleted rows are pruned automatically.
- **Rating score.** Rating cells now render an `N/5` readout right-aligned inside the cell capsule, matching the reference.

### Changed
- **Palette moved from indigo to warm terracotta.** The indigo hexes (`#818CB8`, `#939DC7`, `#282635`, `#716C7E`, `#1C1A26`) are all gone from `styles.css`. Accent and chrome are now `#CC785C` (dark-theme focus/accent-strong `#D97757`), with cream surfaces (`#FAF7F2` page, `#F4EFE6` grid) and warm greys.
- **Status pills are now light tints in both themes**, matching the reference, instead of the dark saturated fills shipped in v0.1.19.
- **Select/model pills are tinted a step richer than status pills.** Scoped to `.tabula-select-trigger` / `.tabula-select-option` and derived from `currentColor`, so it is hue-agnostic and correct in both themes.
- **Geometry matched to the reference:** outer card radius 24px -> 32px, cell capsule 56px -> 34px, column header 42px -> 50px, toolbar title 23px -> 30px serif, buttons and search 34px -> 38px with a 16px radius, `border-spacing` vertical gap 10px -> 8px.
- **Pill shape:** fully rounded 999px -> 6px radius, 11px monospace.
- **Frozen columns re-pointed.** The select band is the new `sticky-col` (left: 0), the row number became `sticky-rownum` (left: 32px) and the first data column's `sticky-primary` offset is now `calc(select + row-number)`. The row-number band is pinned to its token width with `box-sizing: border-box; overflow: hidden` and a smaller drag handle, so a long row number can never grow the band and slide under the first data column.
- **Row height control** now scales cell vertical padding (short 5px, medium 8px, tall 13px). `medium` is the 34px reference default. `--tabula-cell-h` is no longer used; cells size to their content.
- **"+ New row"** now renders the `+` in the terracotta accent.
- **Focus rings** unified to a 2px `--tabula-focus-ring` on the search field, cell inputs and select triggers.

### Corrected against the measured reference

Ten properties were wrong when the styling was written from a visual reading of the
reference. They were re-measured in a real browser and corrected: the header capsule
is 40px tall (not 50px), the **status** pill is a full pill in 12px sans (only the
model badge is 6px / 11px monospace), the title's `letter-spacing` is `normal`, the
header label tracking is 0.3px, the search field is `9999px` with a 40px left inset
and a themed magnifier icon, the star glyph is 12px, the card border uses the plain
border colour (`#E6E0D5` light, `#38342E` dark), and the model badge needed a
three-class selector because `.theme-dark .tabula-color-*` was outranking it.

### Fixed

- **Clicking a cell no longer highlights the whole row.** The `<tr>` carried
  `is-selected` on any row click and `tr.is-selected td { background: … !important }`
  repainted every cell, outranking the focused cell's own surface. Both the row tint
  and the focus-within resets that existed only to counteract it are gone. The
  reference has no row-click handler and no row-selected styling. `selectedRowId`
  still tracks the click so Escape-to-clear keeps working; it simply no longer paints.
- **The table is now full horizontal width.** The card had gained a 28px padding to
  match the reference's `p-7`, which inset the table 28px per side. Removed, along
  with the compensating toolbar and add-row insets it had displaced. This is a
  deliberate departure from the reference. The 6px `border-spacing` gutter between
  cells is unchanged.

### Verification

An interactive verifier was built that inlines this exact `styles.css` and diffs live
computed styles against values measured from the reference in both themes: **58 of
59 properties match exactly in light, 55 of 59 in dark**, with the card padding
reported as a labelled intentional deviation. The three remaining dark differences
are the status pill, which stays a light tint in both themes per an earlier decision,
whereas the reference switches to a dark saturated fill in dark mode.

A Playwright regression additionally asserts: the table is a real `<table>`,
`.tabula-grid-wrap` is still the inner card, the three frozen bands pin at exactly
0 / 32 / 64px and do not overlap while scrolled, the data column scrolls the full
distance, the header pins flush and body content passes behind it, the add-row button
is not sticky, the select column is first in every row, `colSpan` covers the new
column, the `N/5` score is flush to the cell's content edge, and an `is-selected` row
is painted identically to a normal row.

### Fixed — layout reported on a real device

v0.1.20 removed a 28px card padding and was declared fixed, but the verification
harness did not reproduce the real component tree: it omitted `.tabula-file-table`
and `.tabula-grid-area`, and its pane had no fixed height. Every measurement taken
against it was meaningless. Rebuilt on the real tree and re-measured.

- **The empty space under "+ New row" is gone.** `styles.css:230` forced the
  single-table card to `height: 100%` with `flex: 1 1 auto` at every level, so a
  short table left a large empty area inside the card. The card now sizes to its
  content. A table too tall for the pane still scrolls inside the grid box, which
  is unchanged.
- **The table gained 16px per side.** `.tabula-grid-area` carried `16px` horizontal
  padding (8px on mobile) on top of the file root's own page margin, a second
  inset nobody had accounted for. Removed; the card's border is now the frame. The
  "+ New row" button keeps its own 16px margins and stays inset.
- Mobile column widths are unchanged: 160px minimum, so a wide table scrolls
  sideways on a phone by design.

The interactive verifier now mirrors the real tree (file root with `is-single-table`,
file controls, file table, grid area) and pins the pane to the viewport height the
way Obsidian does. Measured after the fix: card height no longer varies with pane
height, empty space inside the grid box 151px -> 2px, horizontal dead space
72px -> 56px per side (48px of which is the Obsidian pane padding plus the
file root's page margin, both kept deliberately).

### Not included
Per scope: the `v2.4` version chip, the "Saved to Anthropic Cloud" title, the Prompt Evaluations / Model Benchmarks tab bar, and the "Dataset:" title.

### Verified
`tsc` clean, production build clean, and a Playwright regression asserting: the table is still a real `<table>`, `.tabula-grid-wrap` is still the inner card, the three frozen bands pin at exactly 0 / 32 / 64px and do not overlap while scrolled 180px, the data column scrolls by the full 180px, the header pins flush to the scroll edge, body content passes behind it, the add-row button is not sticky, the select column is first in every row with one checkbox each, `colSpan` spans cover the new column, the `N/5` score is flush to the cell's content edge, and the `+` is the terracotta chrome colour.

## [0.1.19] - 2026-10-04

Adopts the indigo chrome and component styling from the `database_table_view.html` reference, on top of the v0.1.18 card-cell layout. Visual only - no TypeScript, JSX or logic changes; `main.js` rebuilds byte-identical.

### Changed
- **Chrome moved to indigo/neutral; warm surfaces kept.** Capsule and header borders `#282635`, strong border `#363347`, accent `#818CB8` (hover `#939DC7`), focus ring `#818CB8`, header label `#C4C0CE`, row counter `#7E7A8A`. Surfaces (page, cards, cells) stay warm.
- **Duplicate greys removed.** `--tabula-ink-faint`, `--tabula-muted` and `--tabula-chrome-dim` were split across `#6B7280` and `#666A7F`. Both hexes are gone from the file; all three tokens now use `#716C7E`. This drives the row numbers, the select chevron and the "+ New row" border.
- **Type chip:** now has a real border (`#1C1A26` / `#2B283A` / text `#716C7E`) via a new `--tabula-chip-border` token, declared in both theme blocks.
- **Status pills:** rebuilt on the reference's model - dark saturated fill, bright text, mid border, bright dot. Todo `#3A2A14`/`#E5A855`, In progress `#133129`/`#4EE2B8`, Done `#13321A`/`#50E372`, Blocked `#3A141A`/`#E55567`. The other five colours were derived on the same model.
- **Radii:** outer card 24px, grid container 16px, cell and header capsules 16px, buttons 16px, "+ New row" 16px, type chip 4px, search field a full pill.
- **Tighter grid:** `border-spacing` 6px / 10px (was 12px / 22px), matching the reference.
- **Typography:** serif table title restored; row numbers use the monospace stack via `--font-monospace`.
- **Scrollbar:** 6px with a rounded thumb, **scoped to `.tabula-file-root`** so the rest of Obsidian is untouched.
- **Light theme re-derived** to match the new chrome, keeping warm cream surfaces.

### Kept deliberately
- FontAwesome icons are not adopted - the existing `⠿` grip, `···` menu and CSS-drawn chevron match visually with no new dependency.
- The reference's `select-none` on the table body is not adopted, so cell text stays copyable.
- Warm body ink `#EDE4DA` on the warm surfaces (see plan decision D1).
- Purple ribbon branding and Obsidian's error colour.

### Notes
- The reference mixes a warm inner container (`#2C2320`) with indigo capsules; `--tabula-grid-border` was set to that exact warm value.
- Tokens remain scoped to `.tabula-file-root`; portaled modals and native Obsidian menus still fall back to theme defaults. Pre-existing, unchanged.

---

## [0.1.18] - 2026-10-04

### Changed
- **Card Grid Redesign:** Replaced the dense bordered spreadsheet grid with floating rounded card cells. The `<table>` markup, keyboard navigation, drag-reorder, frozen columns and clipboard handling are unchanged; only presentation changed.
  - `border-spacing: 12px 22px` now provides the gutters, and per-cell `th`/`td` rules were removed.
  - Every cell surface (text, select, currency, checkbox, rating, long text, link, attachments) is now a rounded card with its own border.
  - Row heights retuned to 42 / 56 / 72px for short / medium / tall.
- **Nested Card Chrome:** The table card and the inner grid card now render as separate rounded surfaces (20px radius) with their own borders.
- **Field Headers:** Column headers render as rounded pills with a blue label, a filled type chip (`TEXT`, `SELECT`, ...), and a right-aligned overflow menu.
- **Select Cells:** Added a CSS-drawn chevron and a coloured status dot on every pill. Pills are now fully rounded. The chevron and dot are pure CSS, so no JSX changed.
- **Add Row:** `+ New row` is now a standalone rounded, bordered button instead of a flat footer rule.
- **Palette:** Warm card surfaces with blue-gray chrome and a blue accent (replacing the terracotta accent). The accent now drives focus rings, hover states, drop indicators and stars.
- **Typography:** Table title now uses the interface sans stack instead of Georgia serif.

### Added
- **Light Theme Variant:** A full light palette for the new card design, since the reference is a dark theme.

### Fixed
- **Sticky Cell Opacity:** Frozen row-number and primary columns now keep an opaque background so card cells no longer bleed through while scrolling.
- **Top Scrollbar Corners:** The optional synced top scrollbar and the grid wrap now form a single rounded card.

### Notes
- Ribbon branding (`#8B5CF6` purple) and Obsidian's standard error colour are intentionally unchanged.
- Focus rings are deliberately retained (blue) for keyboard accessibility, even though the reference image shows no focus state.
- Tokens remain scoped to `.tabula-file-root`; UI rendered outside that subtree (portaled modals, native Obsidian menus) still falls back to theme defaults. Pre-existing behaviour, not changed here.

---

## [0.1.16] - 2026-10-04

### Added
- **Restored Signature Warm Branding:** Restored the permanent Anthropic-inspired warm paper aesthetic (ivory card surfaces `#fffdf9`, page `#f5f1eb`, dark mode `#1f1b18`/`#292320`, terracotta accents `#c66d52`/`#a95035`, Georgia serif headers, and warm shadows).
- **Restored Purple Ribbon Action:** Restored the signature `#8B5CF6` purple ribbon icon branding and active styling.
- **Spreadsheet Grid Keyboard Navigation:**
  - `Enter`: Commits current cell and navigates to the row below in the same column. If on the last row, automatically creates a new row.
  - `Tab` / `Shift+Tab`: Moves focus horizontally across cells in the row (wraps at row edges).
  - `ArrowUp` / `ArrowDown`: Navigates vertically between rows.
  - `Escape`: Deselects the active row and blurs cell inputs.
- **Floating Popover for Long Text:** Replaced the in-place expanding `<textarea>` with an anchored floating popover card with character/word counters and `Ctrl+Enter` / `Esc` shortcuts, completely eliminating cumulative layout shift (CLS).
- **Collapsible Group Rows:** Added interactive chevrons (`▾` / `▸`) to group headers, allowing users to collapse or expand grouped rows.
- **Segmented Filter Bar:** Added a mode switcher between **Condition Builder** and **Query Syntax**, cutting vertical toolbar height by more than half.
- **Keyboard Navigation in Select Combobox:** Added `ArrowUp` and `ArrowDown` navigation and Enter selection in the select options dropdown.
- **Data Protection Confirmation:** Added a mandatory confirmation step when clicking "Replace current table" on tables with existing data to prevent accidental data loss.
- **Escape Key Handling:** All modal dialogs (`PasteSpreadsheetModal`, `OptionManager`, `LinkSyncModal`) now dismiss smoothly on pressing `Escape`.
- **Stylus & Touch Column Resizing:** Converted column resizing to `PointerEvent` listeners for mobile and tablet support.

### Changed
- **Column Header Renaming:** Headers are now rendered as static text labels to prevent accidental renaming while clicking or dragging. Renaming is triggered deliberately via double-click, right-click context menu, or the `···` column menu.
- **Numeric & Currency Alignment:** Numbers, currencies, and percentages are now right-aligned with hidden browser number spin buttons.
- **Clipboard Handling:** Single-cell copy/paste no longer opens the global spreadsheet import modal.
- **Mobile Usability:** Reduced mobile row-number column width to 48px and unhid the bottom `+ New row` footer on mobile screens.
- **Stacked Table Headers:** Removed redundant duplicated table title text from stacked section headers.

---

## [0.1.15] - 2026-10-04

### Changed
- Reverted selected-row highlight treatment to standard square selection styling.

---

## [0.1.14] - 2026-10-04

### Changed
- Defaulted primary column freeze to **Off** for newly created tables while preserving explicit saved view configurations.

---

## [0.1.13] - 2026-10-04

### Changed
- Refined selected row highlight with warm square treatment.

---

## [0.1.12] - 2026-10-04

### Added
- Configurable default folder setting for new tables, spreadsheet imports, and pasted tables.
- Stacked-table gap controls (0–500 px slider and numeric input, default 120 px).
- Enhanced mobile table tools and responsive toolbar layout.

---

## [0.1.11] - 2026-10-04

### Added
- Warm Anthropic-inspired table redesign with ivory surfaces, charcoal ink, and terracotta accents.

---

## [0.1.10] - 2026-10-04

### Added
- Stacked table creation menu (`+ Add table` dropdown with Create Stacked, New One, Stacked from Clipboard, and Stacked from CSV/Excel).
- Stacked table vertical spacing controls.

---

## [0.1.9] - 2026-10-04

### Added
- Context menus for cells, rows (row gutter), and column headers.
- Cell clipboard operations (Copy, Cut, Paste into cell, Clear cell).
- Row operations (Insert row above, Insert row below, Duplicate row, Delete row).

---

## [0.1.8] - 2026-10-04

### Added
- Support for multiple independent tables stacked in a single `.tabula` file.
- Backward compatibility for opening existing single-table `.tabula` files.

---

## [0.1.7] - 2026-10-04

### Added
- Direct spreadsheet pasting from clipboard with preview modal.
- Destination choices: Replace current table, Create new table, or Append to current table.
- Optional top synchronized horizontal scrollbar setting.

---

## [0.1.0] - [0.1.6] - 2026-07-11 to 2026-10-04

### Added
- Local Airtable-like tables inside Obsidian with `.tabula` file format.
- Field types: Text, Long Text, Number, Currency, Percent, Duration, Rating, Checkbox, Date, Date & Time, URL, Email, Phone, Single Select, Multi Select, Attachment, Auto Number, Created Time, Last Modified Time.
- Select tag color management and searchable dropdowns.
- Views: Search, Filter builder with AND/OR logic, Query syntax parser, Multi-sort, Group by, Hide fields, Column resize, Column reorder, Freeze primary column, Row height settings (Short, Medium, Tall).
- Optional bi-directional Airtable sync (Link base/table, Pull records, Push records) via Personal Access Token.
- CSV and XLSX file import via ribbon icon and command palette.
