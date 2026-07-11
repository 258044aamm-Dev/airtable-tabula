import { ALL_FIELD_TYPES, FieldType, RowHeight, TableDocument } from "../data/types";
import { MenuSelect } from "./MenuSelect";
import { ReactNode } from "react";

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
	onGroupBy: (fieldId: string | null) => void;
	onRowHeight: (height: RowHeight) => void;
	onToggleFrozen: () => void;
}

export function Toolbar(props: Props) {
	const { doc } = props;
	return (
		<div className="tabula-toolbar">
			<input
				className="tabula-title"
				value={doc.name}
				onChange={(e) => props.onRename(e.target.value)}
				aria-label="Table name"
			/>
			<div className="tabula-toolbar-actions">
				<input
					className="tabula-search"
					type="search"
					placeholder="Search…"
					value={doc.view.search}
					onChange={(e) => props.onSearch(e.target.value)}
					aria-label="Search rows"
				/>
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

				<button
					className="tabula-btn tabula-btn-primary"
					onClick={props.onAddRow}
					type="button"
					title="Add a new row"
				>
					+ Row
				</button>
				<MenuSelect
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
				<span className="tabula-count">
					{props.rowCount}
					{props.rowCount !== doc.rows.length ? ` / ${doc.rows.length}` : ""} rows
				</span>
			</div>
		</div>
	);
}
