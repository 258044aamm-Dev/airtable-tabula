import { useEffect, useId, useState, type ReactNode } from "react";
import { ALL_FIELD_TYPES, FieldType, RowHeight, TableDocument } from "../data/types";
import { MenuSelect } from "./MenuSelect";

interface Props {
	doc: TableDocument;
	rowCount: number;
	showFilters: boolean;
	showSorts: boolean;
	showHide: boolean;
	syncControl?: ReactNode;
	onRename: (name: string) => void;
	onSearch: (search: string) => void;
	onToggleFilters: () => void;
	onToggleSorts: () => void;
	onToggleHide: () => void;
	onAddRow: () => void;
	onAddField: (type: FieldType) => void;
	/** How many rows are currently checked; drives the Delete button. */
	checkedCount: number;
	onRequestDeleteSelected: () => void;
	onGroupBy: (fieldId: string | null) => void;
	onRowHeight: (height: RowHeight) => void;
	onToggleFrozen: () => void;
}

const MOBILE_TOOLBAR_QUERY = "(max-width: 720px)";

export function Toolbar(props: Props) {
	const { doc } = props;
	const [isMobile, setIsMobile] = useState(
		() =>
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia(MOBILE_TOOLBAR_QUERY).matches
	);
	const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
	const mobileToolsId = `tabula-mobile-tools-${useId().replace(/:/g, "")}`;

	useEffect(() => {
		if (typeof window.matchMedia !== "function") return;
		const media = window.matchMedia(MOBILE_TOOLBAR_QUERY);
		const onChange = (event: MediaQueryListEvent) => {
			setIsMobile(event.matches);
			if (!event.matches) setMobileToolsOpen(false);
		};
		if (typeof media.addEventListener === "function") {
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		}
		media.addListener(onChange);
		return () => media.removeListener(onChange);
	}, []);

	const searchControl = (
		<input
			className="tabula-search"
			type="search"
			placeholder="Search…"
			value={doc.view.search}
			onChange={(e) => props.onSearch(e.target.value)}
			aria-label="Search rows"
		/>
	);

	const addRowControl = (
		<button
			className="tabula-btn tabula-btn-primary tabula-add-row-btn"
			onClick={props.onAddRow}
			type="button"
			title="Add a new row"
		>
			+ Row
		</button>
	);

	// Only rendered while rows are checked, so the toolbar returns to exactly
	// the reference layout the moment the selection is cleared.
	const deleteSelectedControl = props.checkedCount > 0 && (
		<button
			className="tabula-btn tabula-btn-danger tabula-delete-selected"
			type="button"
			title={`Delete ${props.checkedCount} selected ${
				props.checkedCount === 1 ? "row" : "rows"
			}`}
			onClick={props.onRequestDeleteSelected}
		>
			Delete ({props.checkedCount})
		</button>
	);

	const addFieldControl = (
		<MenuSelect
			className="tabula-add-field-control"
			variant="button"
			triggerLabel="+ Field"
			title="Add a column"
			ariaLabel="Add field type"
			value=""
			align="right"
			onChange={(type) => {
				if (type) props.onAddField(type as FieldType);
			}}
			options={ALL_FIELD_TYPES.map((ft) => ({
				value: ft.type,
				label: ft.label,
			}))}
		/>
	);

	const toolControls = (
		<>
			<button
				className={`tabula-btn ${props.showFilters ? "is-active" : ""}`}
				onClick={props.onToggleFilters}
				type="button"
				aria-pressed={props.showFilters}
				title="Show filter and query panel"
			>
				Filter
				{doc.view.filters.conditions.length > 0
					? ` (${doc.view.filters.conditions.length})`
					: ""}
			</button>
			<button
				className={`tabula-btn ${props.showSorts || doc.view.sorts.length > 0 ? "is-active" : ""}`}
				onClick={props.onToggleSorts}
				type="button"
				aria-pressed={props.showSorts}
				title="Show sort panel"
			>
				Sort
				{doc.view.sorts.length ? ` (${doc.view.sorts.length})` : ""}
			</button>
			<MenuSelect
				label="Group"
				title="Group rows by field"
				ariaLabel="Group by field"
				value={doc.view.groupBy.fieldId ?? ""}
				onChange={(v) => props.onGroupBy(v || null)}
				options={[
					{ value: "", label: "None" },
					...doc.fields.map((f) => ({ value: f.id, label: f.name })),
				]}
			/>
			<button
				className={`tabula-btn ${props.showHide ? "is-active" : ""}`}
				onClick={props.onToggleHide}
				type="button"
				aria-pressed={props.showHide}
				title="Show or hide columns"
			>
				Hide
				{doc.view.hiddenFieldIds.length
					? ` (${doc.view.hiddenFieldIds.length})`
					: ""}
			</button>

			<span className="tabula-toolbar-sep" aria-hidden="true" />

			<MenuSelect
				label="Height"
				title="Row height"
				ariaLabel="Row height"
				value={doc.view.rowHeight}
				onChange={(v) => props.onRowHeight(v as RowHeight)}
				options={[
					{ value: "short", label: "Short" },
					{ value: "medium", label: "Medium" },
					{ value: "tall", label: "Tall" },
				]}
			/>
			<MenuSelect
				label="Freeze"
				title="Keep the first column fixed while scrolling"
				ariaLabel="Freeze primary column"
				value={doc.view.frozenPrimary ? "on" : "off"}
				onChange={(v) => {
					const next = v === "on";
					if (next !== doc.view.frozenPrimary) props.onToggleFrozen();
				}}
				options={[
					{ value: "on", label: "On" },
					{ value: "off", label: "Off" },
				]}
			/>

			<span className="tabula-toolbar-sep" aria-hidden="true" />

			{props.syncControl}
		</>
	);

	const rowCountText = `${props.rowCount}${props.rowCount !== doc.rows.length ? ` / ${doc.rows.length}` : ""} rows`;
	const rowCountControl = <span className="tabula-count">{rowCountText}</span>;

	return (
		<div className="tabula-toolbar">
			<input
				className="tabula-title"
				value={doc.name}
				onChange={(e) => props.onRename(e.target.value)}
				aria-label="Table name"
			/>
			{isMobile ? (
				<div className="tabula-toolbar-actions tabula-toolbar-actions-mobile">
					<div className="tabula-mobile-primary-row">
						{searchControl}
						{addRowControl}
						{deleteSelectedControl}
						{addFieldControl}
						<button
							className="tabula-btn tabula-mobile-more"
							type="button"
							aria-expanded={mobileToolsOpen}
							aria-controls={mobileToolsOpen ? mobileToolsId : undefined}
							aria-label={mobileToolsOpen ? "Hide table tools" : "More table tools"}
							title={mobileToolsOpen ? "Hide table tools" : "Show more table tools"}
							onClick={() => setMobileToolsOpen((open) => !open)}
						>
							More
							<span className="tabula-menu-chevron" aria-hidden="true">
								▾
							</span>
						</button>
					</div>
					{mobileToolsOpen && (
						<div
							className="tabula-mobile-tools"
							id={mobileToolsId}
							role="toolbar"
							aria-label="More table tools"
							aria-orientation="horizontal"
						>
							{toolControls}
						</div>
					)}
					<span className="tabula-count tabula-mobile-count">{rowCountText}</span>
				</div>
			) : (
				<div className="tabula-toolbar-actions">
					{searchControl}
					<div className="tabula-toolbar-tools-desktop">{toolControls}</div>
					{addRowControl}
					{deleteSelectedControl}
					{addFieldControl}
					{rowCountControl}
				</div>
			)}
		</div>
	);
}
