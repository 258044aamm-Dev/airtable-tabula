import { useRef, useState, type JSX } from "react";
import {
	CellValue,
	Field,
	SelectOption,
	TableDocument,
	visibleFields,
} from "../data/types";
import { RowGroup } from "../data/query";
import { CellEditor } from "./CellEditor";
import { FieldHeaderMenu } from "./FieldHeaderMenu";

interface Props {
	doc: TableDocument;
	groups: RowGroup[];
	selectedRowId: string | null;
	onSelectRow: (rowId: string | null) => void;
	onSetCell: (rowId: string, fieldId: string, value: CellValue) => void;
	onDeleteRow: (rowId: string) => void;
	onRenameField: (fieldId: string, name: string) => void;
	onDeleteField: (fieldId: string) => void;
	onManageOptions: (fieldId: string) => void;
	onAddOption: (fieldId: string, name: string) => SelectOption;
	onSortField: (fieldId: string, direction: "asc" | "desc") => void;
	onHideField: (fieldId: string) => void;
	onInsertField: (fieldId: string, side: "left" | "right") => void;
	onReorderFields: (fromId: string, toId: string) => void;
	onResizeColumn: (fieldId: string, width: number) => void;
	onAddRow: () => void;
}

export function TableGrid(props: Props) {
	const fields = visibleFields(props.doc);
	const frozen = props.doc.view.frozenPrimary;
	const widths = props.doc.view.columnWidths;
	const totalRows = props.groups.reduce((n, g) => n + g.rows.length, 0);

	let rowIndex = 0;
	const body: JSX.Element[] = [];

	for (const group of props.groups) {
		if (group.label !== "") {
			body.push(
				<tr key={`g-${group.key}`} className="tabula-group-row">
					<td colSpan={fields.length + 2}>
						<span className="tabula-group-label">{group.label}</span>
						<span className="tabula-muted"> {group.rows.length}</span>
					</td>
				</tr>
			);
		}
		for (const row of group.rows) {
			rowIndex += 1;
			const index = rowIndex;
			body.push(
				<tr
					key={row.id}
					className={props.selectedRowId === row.id ? "is-selected" : undefined}
					onClick={() => props.onSelectRow(row.id)}
				>
					<td className="tabula-row-num sticky-col">{index}</td>
					{fields.map((field, fi) => (
						<td
							key={field.id}
							className={fi === 0 && frozen ? "sticky-primary" : undefined}
							style={{
								width: widths[field.id] ?? 160,
								minWidth: widths[field.id] ?? 160,
							}}
						>
							<CellEditor
								field={field}
								value={row.cells[field.id]}
								onChange={(value) => props.onSetCell(row.id, field.id, value)}
								onAddOption={(name) => props.onAddOption(field.id, name)}
								onManageOptions={() => props.onManageOptions(field.id)}
							/>
						</td>
					))}
					<td className="tabula-row-actions">
						<button
							className="tabula-btn tabula-icon-btn"
							type="button"
							title="Delete row"
							onClick={(e) => {
								e.stopPropagation();
								props.onDeleteRow(row.id);
							}}
						>
							×
						</button>
					</td>
				</tr>
			);
		}
	}

	return (
		<div className="tabula-grid-wrap">
			<table
				className={`tabula-grid ${frozen ? "is-frozen" : ""} height-${props.doc.view.rowHeight}`}
			>
				<thead>
					<tr>
						<th className="tabula-row-num sticky-col">#</th>
						{fields.map((field, fi) => (
							<th
								key={field.id}
								className={fi === 0 && frozen ? "sticky-primary" : undefined}
								style={{
									width: widths[field.id] ?? 160,
									minWidth: widths[field.id] ?? 160,
								}}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData("text/field-id", field.id);
								}}
								onDragOver={(e) => e.preventDefault()}
								onDrop={(e) => {
									e.preventDefault();
									const fromId = e.dataTransfer.getData("text/field-id");
									if (fromId && fromId !== field.id) {
										props.onReorderFields(fromId, field.id);
									}
								}}
							>
								<FieldHeader
									field={field}
									onRename={props.onRenameField}
									onDelete={props.onDeleteField}
									onManageOptions={props.onManageOptions}
									onSort={props.onSortField}
									onHide={props.onHideField}
									onInsert={props.onInsertField}
									onResize={props.onResizeColumn}
									width={widths[field.id] ?? 160}
								/>
							</th>
						))}
						<th className="tabula-row-actions" />
					</tr>
				</thead>
				<tbody>
					{body}
					{totalRows === 0 && (
						<tr>
							<td colSpan={fields.length + 2} className="tabula-empty">
								No rows match the current search/filters.
							</td>
						</tr>
					)}
				</tbody>
			</table>
			<button className="tabula-add-row-footer" type="button" onClick={props.onAddRow}>
				+ New row
			</button>
		</div>
	);
}

function FieldHeader({
	field,
	onRename,
	onDelete,
	onManageOptions,
	onSort,
	onHide,
	onInsert,
	onResize,
	width,
}: {
	field: Field;
	onRename: (fieldId: string, name: string) => void;
	onDelete: (fieldId: string) => void;
	onManageOptions: (fieldId: string) => void;
	onSort: (fieldId: string, direction: "asc" | "desc") => void;
	onHide: (fieldId: string) => void;
	onInsert: (fieldId: string, side: "left" | "right") => void;
	onResize: (fieldId: string, width: number) => void;
	width: number;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const startX = useRef(0);
	const startW = useRef(width);

	return (
		<div className="tabula-th">
			<input
				className="tabula-th-name"
				value={field.name}
				onChange={(e) => onRename(field.id, e.target.value)}
			/>
			<span className="tabula-th-type">{fieldTypeLabel(field)}</span>
			<button
				className="tabula-btn tabula-icon-btn"
				type="button"
				onClick={() => setMenuOpen((v) => !v)}
				aria-label="Field menu"
			>
				···
			</button>
			{menuOpen && (
				<FieldHeaderMenu
					field={field}
					onClose={() => setMenuOpen(false)}
					onSortAsc={() => {
						onSort(field.id, "asc");
						setMenuOpen(false);
					}}
					onSortDesc={() => {
						onSort(field.id, "desc");
						setMenuOpen(false);
					}}
					onHide={() => {
						onHide(field.id);
						setMenuOpen(false);
					}}
					onManageOptions={() => {
						onManageOptions(field.id);
						setMenuOpen(false);
					}}
					onInsertLeft={() => {
						onInsert(field.id, "left");
						setMenuOpen(false);
					}}
					onInsertRight={() => {
						onInsert(field.id, "right");
						setMenuOpen(false);
					}}
					onDelete={() => {
						onDelete(field.id);
						setMenuOpen(false);
					}}
				/>
			)}
			<div
				className="tabula-col-resize"
				onMouseDown={(e) => {
					e.preventDefault();
					e.stopPropagation();
					startX.current = e.clientX;
					startW.current = width;
					const onMove = (ev: MouseEvent) => {
						const next = Math.max(80, startW.current + (ev.clientX - startX.current));
						onResize(field.id, next);
					};
					const onUp = () => {
						window.removeEventListener("mousemove", onMove);
						window.removeEventListener("mouseup", onUp);
					};
					window.addEventListener("mousemove", onMove);
					window.addEventListener("mouseup", onUp);
				}}
			/>
		</div>
	);
}

function fieldTypeLabel(field: Field): string {
	const map: Record<string, string> = {
		text: "text",
		longText: "long",
		number: "num",
		currency: "$",
		percent: "%",
		duration: "dur",
		rating: "rate",
		checkbox: "check",
		date: "date",
		datetime: "time",
		url: "url",
		email: "mail",
		phone: "phone",
		singleSelect: "select",
		multiSelect: "multi",
		attachment: "file",
		autoNumber: "#",
		createdTime: "created",
		lastModifiedTime: "modified",
	};
	return map[field.type] ?? field.type;
}
