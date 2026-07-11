import { useMemo, useState } from "react";
import { Notice } from "obsidian";
import {
	TableDocument,
	FieldType,
	Field,
	SortSpec,
	RowHeight,
	emptyCellValue,
} from "../data/types";
import {
	createField,
	createRow,
	createSelectOption,
	removeOptionFromDocument,
	touchLastModified,
} from "../data/store";
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
	airtableToken?: string;
}

export function TableApp({ doc, onChange, airtableToken = "" }: Props) {
	const [showFilters, setShowFilters] = useState(
		doc.view.filters.conditions.length > 0 || Boolean(doc.view.query)
	);
	const [showSorts, setShowSorts] = useState(doc.view.sorts.length > 0);
	const [showHide, setShowHide] = useState(false);
	const [optionFieldId, setOptionFieldId] = useState<string | null>(null);
	const [queryError, setQueryError] = useState<string | undefined>();
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [syncBusy, setSyncBusy] = useState(false);

	const groups = useMemo(() => getGroupedRows(doc), [doc]);
	const visibleCount = groups.reduce((n, g) => n + g.rows.length, 0);
	const optionField = doc.fields.find((f) => f.id === optionFieldId) ?? null;
	const hasToken = Boolean(airtableToken.trim());

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

	const addRow = () => {
		const { row, nextAuto } = createRow(doc.fields, doc.autoNumberNext ?? 1);
		updateDoc({
			...doc,
			rows: [...doc.rows, row],
			autoNumberNext: nextAuto,
		});
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

	const setCell = (rowId: string, fieldId: string, value: unknown) => {
		updateDoc({
			...doc,
			rows: doc.rows.map((row) => {
				if (row.id !== rowId) return row;
				const next = {
					...row,
					cells: { ...row.cells, [fieldId]: value as never },
				};
				return touchLastModified(next, doc.fields);
			}),
		});
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

	const reorderFields = (fromId: string, toId: string) => {
		const from = doc.fields.findIndex((f) => f.id === fromId);
		const to = doc.fields.findIndex((f) => f.id === toId);
		if (from < 0 || to < 0 || from === to) return;
		const fields = [...doc.fields];
		const [moved] = fields.splice(from, 1);
		fields.splice(to, 0, moved);
		updateDoc({ ...doc, fields });
	};

	const resizeColumn = (fieldId: string, width: number) => {
		patchView({
			columnWidths: { ...doc.view.columnWidths, [fieldId]: width },
		});
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
		<div className={`tabula-root height-${doc.view.rowHeight}`}>
			<Toolbar
				doc={doc}
				rowCount={visibleCount}
				showFilters={showFilters}
				showSorts={showSorts}
				showHide={showHide}
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
				selectedRowId={selectedRowId}
				onSelectRow={setSelectedRowId}
				onSetCell={setCell}
				onDeleteRow={deleteRow}
				onRenameField={renameField}
				onDeleteField={deleteField}
				onManageOptions={setOptionFieldId}
				onAddOption={addOption}
				onSortField={sortField}
				onHideField={hideField}
				onInsertField={insertField}
				onReorderFields={reorderFields}
				onResizeColumn={resizeColumn}
				onAddRow={addRow}
			/>
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
