# Changelog

All notable changes to **Airtable Tabula** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
