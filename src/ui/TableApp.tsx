import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from "react";
import { Notice } from "obsidian";
import {
	TableDocument,
	FieldType,
	Field,
	SortSpec,
	RowHeight,
	emptyCellValue,
	isReadOnlyField,
} from "../data/types";
import { cellClipboardText, parseCellClipboardText } from "../data/cellClipboard";
import {
	createEmptyView,
	createField,
	createRow,
	createSelectOption,
	reorderById,
	removeOptionFromDocument,
	touchLastModified,
} from "../data/store";
import {
	appendSpreadsheetToTable,
	clipboardHtmlToMatrix,
	clipboardTextToMatrix,
	readSpreadsheetClipboard,
	spreadsheetToMatrix,
} from "../import/spreadsheet";
import { PasteSpreadsheetModal } from "./PasteSpreadsheetModal";
import { ConfirmModal } from "./ConfirmModal";
import type { DropSide } from "./TableGrid";
import {
	filtersToQueryString,
	getGroupedRows,
	parseQueryString,
} from "../data/query";
import { AirtableClient } from "../sync/airtableClient";
import { pullFromAirtable, pushToAirtable } from "../sync/syncEngine";
import { Toolbar } from "./Toolbar";
import { FilterBar } from "./FilterBar";
import { SortBar } from "./SortBar";
import { HideFieldsMenu } from "./HideFieldsMenu";
import { TableGrid } from "./TableGrid";
import { OptionManager } from "./OptionManager";
import { SyncMenu } from "./SyncMenu";
import { LinkSyncModal } from "./LinkSyncModal";

interface Props {
	doc: TableDocument;
	onChange: (doc: TableDocument) => void;
	onCreateTableFromPaste: (doc: TableDocument) => Promise<void>;
	onRegisterClipboardPaste: (handler: (() => void) | null) => void;
	airtableToken?: string;
	showTopScrollbar?: boolean;
}

export function TableApp({
	doc,
	onChange,
	onCreateTableFromPaste,
	onRegisterClipboardPaste,
	airtableToken = "",
	showTopScrollbar = false,
}: Props) {
	const [showFilters, setShowFilters] = useState(
		doc.view.filters.conditions.length > 0 || Boolean(doc.view.query)
	);
	const [showSorts, setShowSorts] = useState(doc.view.sorts.length > 0);
	const [showHide, setShowHide] = useState(false);
	const [optionFieldId, setOptionFieldId] = useState<string | null>(null);
	const [queryError, setQueryError] = useState<string | undefined>();
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const [checkedRowIds, setCheckedRowIds] = useState<ReadonlySet<string>>(() => new Set());
	const [showLinkModal, setShowLinkModal] = useState(false);
	// Non-null while the bulk-delete confirmation is open.
	const [confirmDeleteCount, setConfirmDeleteCount] = useState<number | null>(null);
	const [syncBusy, setSyncBusy] = useState(false);
	const [pasteCandidate, setPasteCandidate] = useState<{
		matrix: unknown[][];
		sourceName: string;
	} | null>(null);

	const groups = useMemo(() => getGroupedRows(doc), [doc]);
	const visibleCount = groups.reduce((n, g) => n + g.rows.length, 0);

	// Row-checkbox selection is view-only state: it is never written to the
	// document, so it cannot affect persisted data or Airtable sync.
	const visibleRowIds = useMemo(
		() => groups.flatMap((g) => g.rows.map((r) => r.id)),
		[groups]
	);
	const allVisibleChecked =
		visibleRowIds.length > 0 && visibleRowIds.every((id) => checkedRowIds.has(id));

	const toggleRowChecked = useCallback((rowId: string) => {
		setCheckedRowIds((prev) => {
			const next = new Set(prev);
			if (next.has(rowId)) next.delete(rowId);
			else next.add(rowId);
			return next;
		});
	}, []);

	const setAllRowsChecked = useCallback(
		(checked: boolean) => {
			setCheckedRowIds((prev) => {
				const next = new Set(prev);
				for (const id of visibleRowIds) {
					if (checked) next.add(id);
					else next.delete(id);
				}
				return next;
			});
		},
		[visibleRowIds]
	);

	// Drop ids for rows that no longer exist, so the set cannot grow unbounded.
	useEffect(() => {
		setCheckedRowIds((prev) => {
			if (prev.size === 0) return prev;
			const live = new Set(doc.rows.map((r) => r.id));
			let changed = false;
			const next = new Set<string>();
			for (const id of prev) {
				if (live.has(id)) next.add(id);
				else changed = true;
			}
			return changed ? next : prev;
		});
	}, [doc.rows]);
	const optionField = doc.fields.find((f) => f.id === optionFieldId) ?? null;
	const hasToken = Boolean(airtableToken.trim());

	const requestClipboardPaste = useCallback(() => {
		void readSpreadsheetClipboard()
			.then((payload) => {
				if (!payload) {
					new Notice("Clipboard has no CSV, XLSX, or spreadsheet cell data");
					return;
				}
				setPasteCandidate(payload);
			})
			.catch((error: unknown) => {
				console.error(error);
				new Notice("Clipboard access was unavailable. Focus the table and press Ctrl/Cmd+V instead.");
			});
	}, []);

	useEffect(() => {
		onRegisterClipboardPaste(requestClipboardPaste);
		return () => onRegisterClipboardPaste(null);
	}, [onRegisterClipboardPaste, requestClipboardPaste]);

	const updateDoc = (next: TableDocument) => onChange(next);
	const patchView = (patch: Partial<TableDocument["view"]>) =>
		updateDoc({ ...doc, view: { ...doc.view, ...patch } });

	const setSearch = (search: string) => patchView({ search });

	const setQuery = (query: string) => {
		const parsed = parseQueryString(query, doc.fields);
		if (!parsed.ok) {
			setQueryError(parsed.error);
			patchView({ query });
			return;
		}
		setQueryError(undefined);
		patchView({ query: parsed.query, filters: parsed.group });
	};

	const setFilters = (filters: TableDocument["view"]["filters"]) => {
		setQueryError(undefined);
		patchView({ filters, query: filtersToQueryString(filters, doc.fields) });
	};

	const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
		if (!(event.target instanceof HTMLElement) || !event.target.closest(".tabula-grid-wrap")) return;
		const transfer = event.clipboardData;
		const files = [
			...Array.from(transfer.files),
			...Array.from(transfer.items)
				.filter((item) => item.kind === "file")
				.map((item) => item.getAsFile())
				.filter((file): file is File => file != null),
		];
		const file = files.find(isSpreadsheetFile);
		if (file) {
			event.preventDefault();
			event.stopPropagation();
			void spreadsheetToMatrix(file)
				.then((matrix) => setPasteCandidate({ matrix, sourceName: file.name }))
				.catch((error: unknown) => {
					console.error(error);
					new Notice(error instanceof Error ? error.message : "Could not read pasted spreadsheet");
				});
			return;
		}

		const types = Array.from(transfer.types);
		const htmlMatrix = clipboardHtmlToMatrix(transfer.getData("text/html"));
		const text = transfer.getData("text/plain");
		const structuredClipboard =
			text.includes("\t") || types.includes("text/csv") || types.includes("text/tab-separated-values");
		const isFormInput =
			event.target instanceof HTMLElement &&
			(event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA");

		// Keep ordinary text editing in active inputs intact
		if (isFormInput && !htmlMatrix && !structuredClipboard) {
			return;
		}

		const matrix = htmlMatrix ?? clipboardTextToMatrix(text, types);
		if (!matrix) return;

		// If it's a single cell, don't open the whole spreadsheet import modal
		const isSingleCell = matrix.length <= 1 && (!matrix[0] || matrix[0].length <= 1);
		if (isSingleCell) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		setPasteCandidate({ matrix, sourceName: "Clipboard Data" });
	};

	const addRow = () => {
		const { row, nextAuto } = createRow(doc.fields, doc.autoNumberNext ?? 1);
		updateDoc({
			...doc,
			rows: [...doc.rows, row],
			autoNumberNext: nextAuto,
		});
	};

	const insertRow = (rowId: string, side: "before" | "after") => {
		if (doc.view.sorts.length > 0) return;
		const sourceIndex = doc.rows.findIndex((row) => row.id === rowId);
		if (sourceIndex < 0) return;
		const { row, nextAuto } = createRow(doc.fields, doc.autoNumberNext ?? 1);
		const rows = [...doc.rows];
		rows.splice(sourceIndex + (side === "after" ? 1 : 0), 0, row);
		updateDoc({ ...doc, rows, autoNumberNext: nextAuto });
		setSelectedRowId(row.id);
	};

	const duplicateRow = (rowId: string) => {
		const sourceIndex = doc.rows.findIndex((row) => row.id === rowId);
		if (sourceIndex < 0) return;
		const source = doc.rows[sourceIndex];
		const generated = createRow(doc.fields, doc.autoNumberNext ?? 1);
		const cells = { ...generated.row.cells };
		for (const field of doc.fields) {
			if (isReadOnlyField(field)) continue;
			const value = source.cells[field.id];
			cells[field.id] = Array.isArray(value) ? [...value] : (value as never);
		}
		const row = touchLastModified({ ...generated.row, cells }, doc.fields);
		const rows = [...doc.rows];
		rows.splice(sourceIndex + 1, 0, row);
		updateDoc({ ...doc, rows, autoNumberNext: generated.nextAuto });
		setSelectedRowId(row.id);
	};

	const deleteRow = (rowId: string) => {
		const recordMap = { ...(doc.sync?.recordMap ?? {}) };
		delete recordMap[rowId];
		updateDoc({
			...doc,
			rows: doc.rows.filter((r) => r.id !== rowId),
			sync: doc.sync ? { ...doc.sync, recordMap } : doc.sync,
		});
		if (selectedRowId === rowId) setSelectedRowId(null);
	};

	/**
	 * Bulk delete for every checked row. Reuses deleteRow's bookkeeping so the
	 * Airtable recordMap and the selected/checked id sets are pruned exactly as
	 * they are for a single-row delete.
	 */
	const deleteCheckedRows = useCallback(() => {
		const ids = [...checkedRowIds];
		if (ids.length === 0) return;
		const doomed = new Set(ids);
		const recordMap = { ...(doc.sync?.recordMap ?? {}) };
		for (const id of ids) delete recordMap[id];
		updateDoc({
			...doc,
			rows: doc.rows.filter((r) => !doomed.has(r.id)),
			sync: doc.sync ? { ...doc.sync, recordMap } : doc.sync,
		});
		if (selectedRowId && doomed.has(selectedRowId)) setSelectedRowId(null);
		setCheckedRowIds(new Set());
	}, [checkedRowIds, doc, selectedRowId, updateDoc]);

	const addField = (type: FieldType, atIndex?: number) => {
		const field = createField(type);
		const fields = [...doc.fields];
		if (atIndex == null) fields.push(field);
		else fields.splice(atIndex, 0, field);

		let autoNumberNext = doc.autoNumberNext ?? 1;
		const rows = doc.rows.map((row) => {
			let cell: ReturnType<typeof emptyCellValue> = emptyCellValue(type);
			if (type === "autoNumber") {
				cell = autoNumberNext;
				autoNumberNext += 1;
			} else if (type === "createdTime" || type === "lastModifiedTime") {
				cell = new Date().toISOString();
			}
			return { ...row, cells: { ...row.cells, [field.id]: cell } };
		});

		updateDoc({ ...doc, fields, rows, autoNumberNext });
	};

	const deleteField = (fieldId: string) => {
		const fieldMap = { ...(doc.sync?.fieldMap ?? {}) };
		delete fieldMap[fieldId];
		updateDoc({
			...doc,
			fields: doc.fields.filter((f) => f.id !== fieldId),
			rows: doc.rows.map((row) => {
				const cells = { ...row.cells };
				delete cells[fieldId];
				return { ...row, cells };
			}),
			view: {
				...doc.view,
				filters: {
					...doc.view.filters,
					conditions: doc.view.filters.conditions.filter((c) => c.fieldId !== fieldId),
				},
				sorts: doc.view.sorts.filter((s) => s.fieldId !== fieldId),
				hiddenFieldIds: doc.view.hiddenFieldIds.filter((id) => id !== fieldId),
				groupBy:
					doc.view.groupBy.fieldId === fieldId
						? { fieldId: null }
						: doc.view.groupBy,
				columnWidths: Object.fromEntries(
					Object.entries(doc.view.columnWidths).filter(([id]) => id !== fieldId)
				),
			},
			sync: doc.sync ? { ...doc.sync, fieldMap } : doc.sync,
		});
	};

	const renameField = (fieldId: string, name: string) => {
		updateDoc({
			...doc,
			fields: doc.fields.map((f) => (f.id === fieldId ? { ...f, name } : f)),
		});
	};

	const updateCellValue = (
		rowId: string,
		fieldId: string,
		value: unknown,
		fieldUpdate?: Field
	) => {
		const fields = fieldUpdate
			? doc.fields.map((field) => (field.id === fieldId ? fieldUpdate : field))
			: doc.fields;
		updateDoc({
			...doc,
			fields,
			rows: doc.rows.map((row) => {
				if (row.id !== rowId) return row;
				const next = {
					...row,
					cells: { ...row.cells, [fieldId]: value as never },
				};
				return touchLastModified(next, fields);
			}),
		});
	};

	const setCell = (rowId: string, fieldId: string, value: unknown) =>
		updateCellValue(rowId, fieldId, value);

	const copyCell = async (rowId: string, fieldId: string): Promise<boolean> => {
		const field = doc.fields.find((candidate) => candidate.id === fieldId);
		const row = doc.rows.find((candidate) => candidate.id === rowId);
		if (!field || !row) return false;
		if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
			new Notice("Clipboard access is unavailable on this device");
			return false;
		}
		try {
			await navigator.clipboard.writeText(cellClipboardText(field, row.cells[fieldId]));
			return true;
		} catch (error) {
			console.error(error);
			new Notice("Could not copy this cell to the clipboard");
			return false;
		}
	};

	const cutCell = async (rowId: string, fieldId: string): Promise<void> => {
		const field = doc.fields.find((candidate) => candidate.id === fieldId);
		if (!field || isReadOnlyField(field)) return;
		if (await copyCell(rowId, fieldId)) {
			updateCellValue(rowId, fieldId, emptyCellValue(field.type));
		}
	};

	const pasteCell = async (rowId: string, fieldId: string): Promise<void> => {
		const field = doc.fields.find((candidate) => candidate.id === fieldId);
		if (!field || isReadOnlyField(field)) return;
		if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
			new Notice("Clipboard access is unavailable on this device");
			return;
		}
		try {
			const parsed = parseCellClipboardText(field, await navigator.clipboard.readText());
			if (!parsed.ok) {
				new Notice(parsed.error);
				return;
			}
			updateCellValue(rowId, fieldId, parsed.value, parsed.field);
		} catch (error) {
			console.error(error);
			new Notice("Could not read the clipboard. Use the table’s standard paste shortcut instead.");
		}
	};

	const clearCell = (rowId: string, fieldId: string): void => {
		const field = doc.fields.find((candidate) => candidate.id === fieldId);
		if (!field || isReadOnlyField(field)) return;
		updateCellValue(rowId, fieldId, emptyCellValue(field.type));
	};

	const updateField = (field: Field) => {
		updateDoc({
			...doc,
			fields: doc.fields.map((f) => (f.id === field.id ? field : f)),
		});
	};

	const addOption = (fieldId: string, name: string) => {
		const option = createSelectOption(name);
		updateDoc({
			...doc,
			fields: doc.fields.map((f) => {
				if (
					f.id !== fieldId ||
					(f.type !== "singleSelect" && f.type !== "multiSelect")
				) {
					return f;
				}
				return { ...f, options: [...f.options, option] };
			}),
		});
		return option;
	};

	const removeOption = (fieldId: string, optionId: string) => {
		updateDoc(removeOptionFromDocument(doc, fieldId, optionId));
	};

	const setSorts = (sorts: SortSpec[]) => patchView({ sorts });

	const sortField = (fieldId: string, direction: "asc" | "desc") => {
		const rest = doc.view.sorts.filter((s) => s.fieldId !== fieldId);
		patchView({ sorts: [{ fieldId, direction }, ...rest] });
		setShowSorts(true);
	};

	const hideField = (fieldId: string) => {
		if (!doc.view.hiddenFieldIds.includes(fieldId)) {
			patchView({ hiddenFieldIds: [...doc.view.hiddenFieldIds, fieldId] });
		}
	};

	const insertField = (fieldId: string, side: "left" | "right") => {
		const idx = doc.fields.findIndex((f) => f.id === fieldId);
		if (idx < 0) return;
		addField("text", side === "left" ? idx : idx + 1);
	};

	const reorderFields = (fromId: string, toId: string, side: DropSide) => {
		const fields = reorderById(doc.fields, fromId, toId, side);
		if (fields !== doc.fields) updateDoc({ ...doc, fields });
	};

	const reorderRows = (fromId: string, toId: string, side: DropSide) => {
		if (doc.view.sorts.length > 0) return;
		const rows = reorderById(doc.rows, fromId, toId, side);
		if (rows !== doc.rows) updateDoc({ ...doc, rows });
	};

	const resizeColumn = (fieldId: string, width: number) => {
		patchView({
			columnWidths: { ...doc.view.columnWidths, [fieldId]: width },
		});
	};

	const replaceFromPaste = (incoming: TableDocument) => {
		updateDoc({
			...incoming,
			name: doc.name,
			view: createEmptyView(),
			sync: null,
		});
		setSelectedRowId(null);
		setShowFilters(false);
		setShowSorts(false);
		setShowHide(false);
		setQueryError(undefined);
		setPasteCandidate(null);
		new Notice(`Replaced table with ${incoming.rows.length} rows`);
	};

	const appendFromPaste = (incoming: TableDocument) => {
		const result = appendSpreadsheetToTable(doc, incoming);
		updateDoc(result.doc);
		setPasteCandidate(null);
		new Notice(
			`Appended ${result.addedRows} rows${result.addedFields ? ` and added ${result.addedFields} fields` : ""}`
		);
		if (doc.sync && result.addedFields > 0) {
			new Notice("New fields are local only until they are mapped to Airtable");
		}
	};

	const createFromPaste = async (incoming: TableDocument) => {
		try {
			await onCreateTableFromPaste(incoming);
			setPasteCandidate(null);
		} catch (error) {
			console.error(error);
			new Notice(error instanceof Error ? error.message : "Could not create a table from pasted data");
		}
	};

	const runPull = async () => {
		if (!hasToken || !doc.sync) return;
		setSyncBusy(true);
		try {
			const client = new AirtableClient(airtableToken.trim());
			const next = await pullFromAirtable(client, doc);
			updateDoc(next);
			new Notice(`Pulled ${next.rows.length} rows from Airtable`);
		} catch (e) {
			console.error(e);
			new Notice(e instanceof Error ? e.message : "Pull failed");
		} finally {
			setSyncBusy(false);
		}
	};

	const runPush = async () => {
		if (!hasToken || !doc.sync) return;
		setSyncBusy(true);
		try {
			const client = new AirtableClient(airtableToken.trim());
			const next = await pushToAirtable(client, doc);
			updateDoc(next);
			new Notice(`Pushed ${doc.rows.length} rows to Airtable`);
		} catch (e) {
			console.error(e);
			new Notice(e instanceof Error ? e.message : "Push failed");
		} finally {
			setSyncBusy(false);
		}
	};

	return (
		<div className={`tabula-root height-${doc.view.rowHeight}`} onPaste={handlePaste}>
			<Toolbar
				doc={doc}
				rowCount={visibleCount}
				showFilters={showFilters}
				showSorts={showSorts}
				showHide={showHide}
				checkedCount={checkedRowIds.size}
				onRequestDeleteSelected={() => setConfirmDeleteCount(checkedRowIds.size)}
				syncControl={
					<SyncMenu
						linked={Boolean(doc.sync)}
						sync={doc.sync}
						busy={syncBusy}
						hasToken={hasToken}
						onLink={() => setShowLinkModal(true)}
						onPull={() => void runPull()}
						onPush={() => void runPush()}
						onUnlink={() => updateDoc({ ...doc, sync: null })}
					/>
				}
				onRename={(name) => updateDoc({ ...doc, name })}
				onSearch={setSearch}
				onToggleFilters={() => setShowFilters((v) => !v)}
				onToggleSorts={() => setShowSorts((v) => !v)}
				onToggleHide={() => setShowHide((v) => !v)}
				onAddRow={addRow}
				onAddField={(type) => addField(type)}
				onGroupBy={(fieldId) => patchView({ groupBy: { fieldId } })}
				onRowHeight={(rowHeight: RowHeight) => patchView({ rowHeight })}
				onToggleFrozen={() =>
					patchView({ frozenPrimary: !doc.view.frozenPrimary })
				}
			/>
			{showFilters && (
				<FilterBar
					doc={doc}
					queryError={queryError}
					onQueryChange={setQuery}
					onFiltersChange={setFilters}
				/>
			)}
			{showSorts && <SortBar doc={doc} onChange={setSorts} />}
			{showHide && (
				<HideFieldsMenu
					doc={doc}
					onChange={(hiddenFieldIds) => patchView({ hiddenFieldIds })}
				/>
			)}
			<TableGrid
				doc={doc}
				groups={groups}
				showTopScrollbar={showTopScrollbar}
				selectedRowId={selectedRowId}
				checkedRowIds={checkedRowIds}
				allVisibleChecked={allVisibleChecked}
				onToggleRowChecked={toggleRowChecked}
				onSetAllRowsChecked={setAllRowsChecked}
				canReorderRows={doc.view.sorts.length === 0}
				onSelectRow={setSelectedRowId}
				onSetCell={setCell}
				onCopyCell={copyCell}
				onCutCell={cutCell}
				onPasteCell={pasteCell}
				onClearCell={clearCell}
				onInsertRow={insertRow}
				onDuplicateRow={duplicateRow}
				onDeleteRow={deleteRow}
				onRenameField={renameField}
				onDeleteField={deleteField}
				onManageOptions={setOptionFieldId}
				onAddOption={addOption}
				onSortField={sortField}
				onHideField={hideField}
				onInsertField={insertField}
				onReorderRows={reorderRows}
				onReorderFields={reorderFields}
				onResizeColumn={resizeColumn}
				onAddRow={addRow}
			/>
			{confirmDeleteCount !== null && confirmDeleteCount > 0 && (
				<ConfirmModal
					count={confirmDeleteCount}
					tableName={doc.name}
					onConfirm={deleteCheckedRows}
					onClose={() => setConfirmDeleteCount(null)}
				/>
			)}
			{pasteCandidate && (
				<PasteSpreadsheetModal
					matrix={pasteCandidate.matrix}
					sourceName={pasteCandidate.sourceName}
					currentDoc={doc}
					onClose={() => setPasteCandidate(null)}
					onReplace={replaceFromPaste}
					onAppend={appendFromPaste}
					onCreateNew={createFromPaste}
				/>
			)}
			{optionField &&
				(optionField.type === "singleSelect" ||
					optionField.type === "multiSelect") && (
					<OptionManager
						field={optionField}
						onClose={() => setOptionFieldId(null)}
						onChange={updateField}
						onRemoveOption={(optionId) =>
							removeOption(optionField.id, optionId)
						}
					/>
				)}
			{showLinkModal && hasToken && (
				<LinkSyncModal
					token={airtableToken.trim()}
					doc={doc}
					onClose={() => setShowLinkModal(false)}
					onLinked={(next) => {
						updateDoc(next);
						new Notice(
							`Linked to ${next.sync?.baseName ?? "base"} / ${next.sync?.tableName ?? "table"}`
						);
					}}
				/>
			)}
		</div>
	);
}

function isSpreadsheetFile(file: File): boolean {
	const name = file.name.toLowerCase();
	return (
		name.endsWith(".csv") ||
		name.endsWith(".xlsx") ||
		file.type === "text/csv" ||
		file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	);
}
