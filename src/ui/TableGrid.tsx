import {
	useEffect,
	useRef,
	useState,
	type JSX,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { Menu } from "obsidian";
import {
	CellValue,
	Field,
	SelectOption,
	TableDocument,
	isReadOnlyField,
	isSelectField,
	visibleFields,
} from "../data/types";
import { RowGroup } from "../data/query";
import { CellEditor } from "./CellEditor";
import { FieldHeaderMenu } from "./FieldHeaderMenu";

export type DropSide = "before" | "after";
type ReorderKind = "row" | "field";

interface ReorderDragState {
	kind: ReorderKind;
	sourceId: string;
	targetId: string | null;
	side: DropSide | null;
}

interface Props {
	doc: TableDocument;
	groups: RowGroup[];
	showTopScrollbar: boolean;
	selectedRowId: string | null;
	canReorderRows: boolean;
	onSelectRow: (rowId: string | null) => void;
	onSetCell: (rowId: string, fieldId: string, value: CellValue) => void;
	onCopyCell: (rowId: string, fieldId: string) => Promise<boolean>;
	onCutCell: (rowId: string, fieldId: string) => Promise<void>;
	onPasteCell: (rowId: string, fieldId: string) => Promise<void>;
	onClearCell: (rowId: string, fieldId: string) => void;
	onInsertRow: (rowId: string, side: "before" | "after") => void;
	onDuplicateRow: (rowId: string) => void;
	onDeleteRow: (rowId: string) => void;
	onRenameField: (fieldId: string, name: string) => void;
	onDeleteField: (fieldId: string) => void;
	onManageOptions: (fieldId: string) => void;
	onAddOption: (fieldId: string, name: string) => SelectOption;
	onSortField: (fieldId: string, direction: "asc" | "desc") => void;
	onHideField: (fieldId: string) => void;
	onInsertField: (fieldId: string, side: "left" | "right") => void;
	onReorderRows: (fromId: string, toId: string, side: DropSide) => void;
	onReorderFields: (fromId: string, toId: string, side: DropSide) => void;
	onResizeColumn: (fieldId: string, width: number) => void;
	onAddRow: () => void;
}

export function TableGrid(props: Props) {
	const fields = visibleFields(props.doc);
	const frozen = props.doc.view.frozenPrimary;
	const widths = props.doc.view.columnWidths;
	const totalRows = props.groups.reduce((n, g) => n + g.rows.length, 0);
	const [dragState, setDragState] = useState<ReorderDragState | null>(null);
	const dragCleanup = useRef<(() => void) | null>(null);
	const gridWrapRef = useRef<HTMLDivElement | null>(null);
	const topScrollbarRef = useRef<HTMLDivElement | null>(null);
	const topScrollbarInnerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!props.showTopScrollbar) return;
		const gridWrap = gridWrapRef.current;
		const topScrollbar = topScrollbarRef.current;
		const inner = topScrollbarInnerRef.current;
		if (!gridWrap || !topScrollbar || !inner) return;

		const updateWidth = () => {
			const gridOverflow = Math.max(0, gridWrap.scrollWidth - gridWrap.clientWidth);
			topScrollbar.style.display = gridOverflow > 0 ? "" : "none";
			inner.style.width = `${topScrollbar.clientWidth + gridOverflow}px`;
			if (topScrollbar.scrollLeft !== gridWrap.scrollLeft) {
				topScrollbar.scrollLeft = gridWrap.scrollLeft;
			}
		};
		const syncFromGrid = () => {
			if (topScrollbar.scrollLeft !== gridWrap.scrollLeft) {
				topScrollbar.scrollLeft = gridWrap.scrollLeft;
			}
		};
		const syncFromTop = () => {
			if (gridWrap.scrollLeft !== topScrollbar.scrollLeft) {
				gridWrap.scrollLeft = topScrollbar.scrollLeft;
			}
		};

		gridWrap.addEventListener("scroll", syncFromGrid, { passive: true });
		topScrollbar.addEventListener("scroll", syncFromTop, { passive: true });
		window.addEventListener("resize", updateWidth);
		const resizeObserver =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateWidth) : null;
		resizeObserver?.observe(gridWrap);
		resizeObserver?.observe(topScrollbar);
		const table = gridWrap.querySelector("table");
		if (table) resizeObserver?.observe(table);
		updateWidth();

		return () => {
			gridWrap.removeEventListener("scroll", syncFromGrid);
			topScrollbar.removeEventListener("scroll", syncFromTop);
			window.removeEventListener("resize", updateWidth);
			resizeObserver?.disconnect();
		};
	}, [props.showTopScrollbar]);

	const addRowContextItems = (menu: Menu, rowId: string) => {
		if (!props.canReorderRows) {
			menu.addItem((item) => item.setTitle("Clear sorting to insert in place").setIsLabel(true));
		}
		menu.addItem((item) =>
			item
				.setTitle("Insert row above")
				.setDisabled(!props.canReorderRows)
				.onClick(() => props.onInsertRow(rowId, "before"))
		);
		menu.addItem((item) =>
			item
				.setTitle("Insert row below")
				.setDisabled(!props.canReorderRows)
				.onClick(() => props.onInsertRow(rowId, "after"))
		);
		menu.addItem((item) => item.setTitle("Duplicate row").onClick(() => props.onDuplicateRow(rowId)));
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Delete row")
				.setWarning(true)
				.onClick(() => props.onDeleteRow(rowId))
		);
	};

	const showRowContextMenu = (event: ReactMouseEvent<HTMLElement>, rowId: string) => {
		event.preventDefault();
		event.stopPropagation();
		const menu = new Menu();
		addRowContextItems(menu, rowId);
		menu.showAtMouseEvent(event.nativeEvent);
	};

	const showCellContextMenu = (
		event: ReactMouseEvent<HTMLTableCellElement>,
		rowId: string,
		field: Field
	) => {
		event.preventDefault();
		event.stopPropagation();
		const menu = new Menu();
		const readOnly = isReadOnlyField(field);
		menu.addItem((item) =>
			item.setTitle("Copy cell").onClick(() => void props.onCopyCell(rowId, field.id))
		);
		menu.addItem((item) =>
			item
				.setTitle("Cut cell")
				.setDisabled(readOnly)
				.onClick(() => void props.onCutCell(rowId, field.id))
		);
		menu.addItem((item) =>
			item
				.setTitle("Paste into cell")
				.setDisabled(readOnly)
				.onClick(() => void props.onPasteCell(rowId, field.id))
		);
		menu.addItem((item) =>
			item
				.setTitle("Clear cell")
				.setDisabled(readOnly)
				.onClick(() => props.onClearCell(rowId, field.id))
		);
		menu.addSeparator();
		addRowContextItems(menu, rowId);
		menu.showAtMouseEvent(event.nativeEvent);
	};

	const startReorder = (
		kind: ReorderKind,
		sourceId: string,
		event: ReactPointerEvent<HTMLElement>
	) => {
		if ((event.pointerType === "mouse" && event.button !== 0) || (kind === "row" && !props.canReorderRows)) return;
		event.preventDefault();
		event.stopPropagation();
		dragCleanup.current?.();
		setDragState({ kind, sourceId, targetId: null, side: null });

		const pointerId = event.pointerId;
		const scrollContainer = event.currentTarget.closest<HTMLElement>(".tabula-grid-wrap");
		const findDropTarget = (pointerEvent: PointerEvent) => {
			const element = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
			const target = element?.closest<HTMLElement>("[data-reorder-kind]");
			if (!target || target.dataset.reorderKind !== kind) return null;
			const targetId = target.dataset.reorderId;
			if (!targetId) return null;
			const rect = target.getBoundingClientRect();
			const coordinate = kind === "row" ? pointerEvent.clientY : pointerEvent.clientX;
			const midpoint = kind === "row" ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
			return { targetId, side: coordinate < midpoint ? "before" as const : "after" as const };
		};

		const cleanup = () => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			document.removeEventListener("pointercancel", onCancel);
			window.removeEventListener("blur", onCancel);
			if (dragCleanup.current === cleanup) dragCleanup.current = null;
		};
		const onMove = (pointerEvent: PointerEvent) => {
			if (pointerEvent.pointerId !== pointerId) return;
			pointerEvent.preventDefault();
			if (scrollContainer) {
				const bounds = scrollContainer.getBoundingClientRect();
				const edge = 36;
				if (kind === "row") {
					if (pointerEvent.clientY < bounds.top + edge) scrollContainer.scrollTop -= 14;
					else if (pointerEvent.clientY > bounds.bottom - edge) scrollContainer.scrollTop += 14;
				} else {
					if (pointerEvent.clientX < bounds.left + edge) scrollContainer.scrollLeft -= 14;
					else if (pointerEvent.clientX > bounds.right - edge) scrollContainer.scrollLeft += 14;
				}
			}
			const target = findDropTarget(pointerEvent);
			setDragState((current) => {
				if (!current || current.sourceId !== sourceId || current.kind !== kind) return current;
				if (current.targetId === (target?.targetId ?? null) && current.side === (target?.side ?? null)) {
					return current;
				}
				return {
					...current,
					targetId: target?.targetId ?? null,
					side: target?.side ?? null,
				};
			});
		};
		const onUp = (pointerEvent: PointerEvent) => {
			if (pointerEvent.pointerId !== pointerId) return;
			pointerEvent.preventDefault();
			const target = findDropTarget(pointerEvent);
			cleanup();
			setDragState(null);
			if (!target || target.targetId === sourceId) return;
			if (kind === "row") props.onReorderRows(sourceId, target.targetId, target.side);
			else props.onReorderFields(sourceId, target.targetId, target.side);
		};
		const onCancel = () => {
			cleanup();
			setDragState(null);
		};

		dragCleanup.current = cleanup;
		document.addEventListener("pointermove", onMove, { passive: false });
		document.addEventListener("pointerup", onUp);
		document.addEventListener("pointercancel", onCancel);
		window.addEventListener("blur", onCancel);
	};

	useEffect(
		() => () => {
			dragCleanup.current?.();
		},
		[]
	);

	let rowIndex = 0;
	const body: JSX.Element[] = [];

	for (const group of props.groups) {
		if (group.label !== "") {
			body.push(
				<tr key={`g-${group.key}`} className="tabula-group-row">
					<td colSpan={fields.length + 1}>
						<span className="tabula-group-label">{group.label}</span>
						<span className="tabula-muted"> {group.rows.length}</span>
					</td>
				</tr>
			);
		}
		for (const row of group.rows) {
			rowIndex += 1;
			const index = rowIndex;
			const isDragSource = dragState?.kind === "row" && dragState.sourceId === row.id;
			const dropClass =
				dragState?.kind === "row" && dragState.targetId === row.id
					? dragState.side === "before"
						? "is-drop-before"
						: "is-drop-after"
					: "";
			body.push(
				<tr
					key={row.id}
					data-reorder-kind={props.canReorderRows ? "row" : undefined}
					data-reorder-id={props.canReorderRows ? row.id : undefined}
					onContextMenu={(event) => showRowContextMenu(event, row.id)}
					className={[
						props.selectedRowId === row.id ? "is-selected" : "",
						isDragSource ? "is-dragging" : "",
						dropClass,
					]
						.filter(Boolean)
						.join(" ") || undefined}
					onClick={() => props.onSelectRow(row.id)}
				>
					<td
						className="tabula-row-num sticky-col"
						onContextMenu={(event) => showRowContextMenu(event, row.id)}
					>
						<div className="tabula-row-num-content">
							<span>{index}</span>
							<button
								className="tabula-row-drag-handle"
								type="button"
								aria-label={`Drag row ${index} to reorder`}
								title={
									props.canReorderRows
										? "Drag to reorder row"
										: "Clear sorting to manually reorder rows"
								}
								disabled={!props.canReorderRows}
								onPointerDown={(event) => startReorder("row", row.id, event)}
								onClick={(event) => event.stopPropagation()}
							>
								⠿
							</button>
						</div>
					</td>
					{fields.map((field, fi) => (
						<td
							key={field.id}
							className={fi === 0 && frozen ? "sticky-primary" : undefined}
							onContextMenu={(event) => showCellContextMenu(event, row.id, field)}
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
				</tr>
			);
		}
	}

	return (
		<div className="tabula-grid-area">
			{props.showTopScrollbar && (
				<div
					className="tabula-top-scrollbar"
					ref={topScrollbarRef}
					tabIndex={0}
					aria-label="Synchronized horizontal scrollbar for table"
				>
					<div className="tabula-top-scrollbar-inner" ref={topScrollbarInnerRef} />
				</div>
			)}
			<div className="tabula-grid-wrap" ref={gridWrapRef} tabIndex={0} aria-label="Table data grid">
				<table
					className={`tabula-grid ${frozen ? "is-frozen" : ""} height-${props.doc.view.rowHeight}`}
				>
					<thead>
						<tr>
							<th className="tabula-row-num sticky-col">#</th>
							{fields.map((field, fi) => {
								const isDragSource = dragState?.kind === "field" && dragState.sourceId === field.id;
								const dropClass =
									dragState?.kind === "field" && dragState.targetId === field.id
										? dragState.side === "before"
											? "is-drop-before"
											: "is-drop-after"
										: "";
								return (
									<th
										key={field.id}
										data-reorder-kind="field"
										data-reorder-id={field.id}
										className={[
											fi === 0 && frozen ? "sticky-primary" : "",
											isDragSource ? "is-dragging" : "",
											dropClass,
										]
											.filter(Boolean)
											.join(" ") || undefined}
										style={{
											width: widths[field.id] ?? 160,
											minWidth: widths[field.id] ?? 160,
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
											onBeginReorder={(event) => startReorder("field", field.id, event)}
											width={widths[field.id] ?? 160}
										/>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{body}
						{totalRows === 0 && (
							<tr>
								<td colSpan={fields.length + 1} className="tabula-empty">
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
	onBeginReorder,
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
	onBeginReorder: (event: ReactPointerEvent<HTMLElement>) => void;
	width: number;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const startX = useRef(0);
	const startW = useRef(width);
	const nameInputRef = useRef<HTMLInputElement>(null);

	const showFieldContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		const menu = new Menu();
		menu.addItem((item) =>
			item.setTitle("Rename column").onClick(() => {
				window.setTimeout(() => {
					nameInputRef.current?.focus();
					nameInputRef.current?.select();
				}, 0);
			})
		);
		menu.addItem((item) => item.setTitle("Insert column left").onClick(() => onInsert(field.id, "left")));
		menu.addItem((item) => item.setTitle("Insert column right").onClick(() => onInsert(field.id, "right")));
		menu.addSeparator();
		menu.addItem((item) => item.setTitle("Sort A → Z").onClick(() => onSort(field.id, "asc")));
		menu.addItem((item) => item.setTitle("Sort Z → A").onClick(() => onSort(field.id, "desc")));
		menu.addItem((item) => item.setTitle("Hide column").onClick(() => onHide(field.id)));
		if (isSelectField(field)) {
			menu.addItem((item) => item.setTitle("Manage options…").onClick(() => onManageOptions(field.id)));
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Delete column")
				.setWarning(true)
				.onClick(() => {
					if (window.confirm(`Delete “${field.name}” and all its cell values?`)) {
						onDelete(field.id);
					}
				})
		);
		menu.showAtMouseEvent(event.nativeEvent);
	};

	return (
		<div className="tabula-th" onContextMenu={showFieldContextMenu}>
			<button
				className="tabula-col-drag-handle"
				type="button"
				aria-label={`Drag ${field.name} column to reorder`}
				title="Drag to move column left or right"
				onPointerDown={onBeginReorder}
				onClick={(event) => event.stopPropagation()}
			>
				⠿
			</button>
			<input
				ref={nameInputRef}
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
					if (e.button !== 0) return;
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
