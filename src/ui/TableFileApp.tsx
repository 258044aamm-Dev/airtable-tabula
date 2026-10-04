import { useCallback, useEffect, useRef, useState } from "react";
import { Notice } from "obsidian";
import { TableDocument, TableFileDocument } from "../data/types";
import { TableApp } from "./TableApp";

interface Props {
	file: TableFileDocument;
	onTableChange: (tableId: string, doc: TableDocument) => void;
	onAddTable: () => string;
	onRemoveTable: (tableId: string) => void;
	onCreateTableFromPaste: (doc: TableDocument) => Promise<void>;
	onRegisterClipboardPaste: (handler: (() => void) | null) => void;
	airtableToken?: string;
	showTopScrollbar: boolean;
}

export function TableFileApp({
	file,
	onTableChange,
	onAddTable,
	onRemoveTable,
	onCreateTableFromPaste,
	onRegisterClipboardPaste,
	airtableToken = "",
	showTopScrollbar,
}: Props) {
	const [activeTableId, setActiveTableId] = useState(file.tables[0]?.id ?? "");
	const activeTableIdRef = useRef(activeTableId);
	const clipboardHandlers = useRef(new Map<string, () => void>());
	activeTableIdRef.current = activeTableId;

	useEffect(() => {
		if (!file.tables.some((entry) => entry.id === activeTableId)) {
			const nextId = file.tables[0]?.id ?? "";
			activeTableIdRef.current = nextId;
			setActiveTableId(nextId);
		}
	}, [activeTableId, file.tables]);

	const dispatchClipboardPaste = useCallback(() => {
		const handler = clipboardHandlers.current.get(activeTableIdRef.current);
		if (handler) handler();
		else new Notice("Click inside a table before pasting from the ribbon");
	}, []);

	useEffect(() => {
		onRegisterClipboardPaste(dispatchClipboardPaste);
		return () => onRegisterClipboardPaste(null);
	}, [dispatchClipboardPaste, onRegisterClipboardPaste]);

	const registerTableClipboardPaste = useCallback(
		(tableId: string, handler: (() => void) | null) => {
			if (handler) clipboardHandlers.current.set(tableId, handler);
			else clipboardHandlers.current.delete(tableId);
		},
		[]
	);

	const addTable = () => {
		const tableId = onAddTable();
		activeTableIdRef.current = tableId;
		setActiveTableId(tableId);
	};

	const removeTable = (tableId: string, tableName: string, nextId: string) => {
		if (file.tables.length <= 1) return;
		if (!window.confirm(`Remove “${tableName || "Untitled"}” from this file? This cannot be undone.`)) return;
		if (activeTableIdRef.current === tableId) {
			activeTableIdRef.current = nextId;
			setActiveTableId(nextId);
		}
		clipboardHandlers.current.delete(tableId);
		onRemoveTable(tableId);
		new Notice(`Removed ${tableName || "table"}`);
	};

	return (
		<div className={`tabula-file-root ${file.tables.length === 1 ? "is-single-table" : ""}`}>
			<div className="tabula-file-controls">
				<span className="tabula-file-count">
					{file.tables.length} {file.tables.length === 1 ? "table" : "tables"} in this file
				</span>
				<button className="tabula-btn tabula-btn-primary" type="button" onClick={addTable}>
					+ Add table
				</button>
			</div>
			{file.tables.map((entry, index) => (
				<section
					key={entry.id}
					className="tabula-file-table"
					onPointerDownCapture={() => setActiveTableId(entry.id)}
					onFocusCapture={() => setActiveTableId(entry.id)}
				>
					{file.tables.length > 1 && (
						<div className="tabula-table-section-header">
							<div className="tabula-table-section-title">
								<span className="tabula-table-section-index">Table {index + 1}</span>
								<span className="tabula-table-section-name">{entry.table.name}</span>
							</div>
							<button
								className="tabula-btn tabula-btn-danger"
								type="button"
								title={`Remove ${entry.table.name || "table"}`}
								aria-label={`Remove table ${index + 1}: ${entry.table.name || "Untitled"}`}
								onClick={() =>
									removeTable(
										entry.id,
										entry.table.name,
										file.tables[index === 0 ? 1 : index - 1]?.id ?? ""
									)
								}
							>
								Remove table
							</button>
						</div>
					)}
					<TableApp
						doc={entry.table}
						onChange={(doc) => onTableChange(entry.id, doc)}
						onCreateTableFromPaste={onCreateTableFromPaste}
						onRegisterClipboardPaste={(handler) =>
							registerTableClipboardPaste(entry.id, handler)
						}
						airtableToken={airtableToken}
						showTopScrollbar={showTopScrollbar}
					/>
				</section>
			))}
		</div>
	);
}
