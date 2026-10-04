import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type MouseEvent as ReactMouseEvent,
} from "react";
import { Menu, Notice } from "obsidian";
import { TableDocument, TableFileDocument } from "../data/types";
import type { TabulaTheme } from "../settings";
import {
	pickSpreadsheetFile,
	readSpreadsheetClipboard,
	spreadsheetToMatrix,
} from "../import/spreadsheet";
import { PasteSpreadsheetModal } from "./PasteSpreadsheetModal";
import { TableApp } from "./TableApp";

interface Props {
	file: TableFileDocument;
	onTableChange: (tableId: string, doc: TableDocument) => void;
	onAddTable: (doc?: TableDocument) => string;
	onRemoveTable: (tableId: string) => void;
	onCreateTableFromPaste: (doc: TableDocument) => Promise<void>;
	onCreateStandaloneTable: () => Promise<void>;
	onRegisterClipboardPaste: (handler: (() => void) | null) => void;
	airtableToken?: string;
	showTopScrollbar: boolean;
	stackedTableGap: number;
	appearanceTheme: TabulaTheme;
}

export function TableFileApp({
	file,
	onTableChange,
	onAddTable,
	onRemoveTable,
	onCreateTableFromPaste,
	onCreateStandaloneTable,
	onRegisterClipboardPaste,
	airtableToken = "",
	showTopScrollbar,
	stackedTableGap,
	appearanceTheme = "native",
}: Props) {
	const [activeTableId, setActiveTableId] = useState(file.tables[0]?.id ?? "");
	const [stackedImportCandidate, setStackedImportCandidate] = useState<{
		matrix: unknown[][];
		sourceName: string;
	} | null>(null);
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

	const addTable = (table?: TableDocument) => {
		const tableId = onAddTable(table);
		activeTableIdRef.current = tableId;
		setActiveTableId(tableId);
	};

	const createStackedFromClipboard = async () => {
		try {
			const payload = await readSpreadsheetClipboard();
			if (!payload) {
				new Notice("Clipboard does not contain spreadsheet data. Copy a cell range first.");
				return;
			}
			setStackedImportCandidate(payload);
		} catch (error) {
			console.error(error);
			new Notice(error instanceof Error ? error.message : "Could not read spreadsheet data from clipboard");
		}
	};

	const createStackedFromFile = async () => {
		try {
			const selectedFile = await pickSpreadsheetFile();
			if (!selectedFile) return;
			const matrix = await spreadsheetToMatrix(selectedFile);
			setStackedImportCandidate({ matrix, sourceName: selectedFile.name });
		} catch (error) {
			console.error(error);
			new Notice(error instanceof Error ? error.message : "Could not import spreadsheet");
		}
	};

	const showAddTableMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		const menu = new Menu();
		menu.addItem((item) => item.setTitle("Create stacked").onClick(() => addTable()));
		menu.addItem((item) =>
			item.setTitle("New one").onClick(() => void onCreateStandaloneTable())
		);
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Create stacked table from clipboard")
				.onClick(() => void createStackedFromClipboard())
		);
		menu.addItem((item) =>
			item
				.setTitle("Create stacked table from imported CSV or Excel file")
				.onClick(() => void createStackedFromFile())
		);
		menu.showAtMouseEvent(event.nativeEvent);
	};

	const createStackedFromPreview = async (table: TableDocument) => {
		const tableId = onAddTable(table);
		activeTableIdRef.current = tableId;
		setActiveTableId(tableId);
		new Notice(`Added “${table.name}” as a stacked table`);
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
		<div
			className={`tabula-file-root ${file.tables.length === 1 ? "is-single-table" : ""} tabula-theme-${appearanceTheme}`}
			style={{
				"--tabula-stacked-table-gap": `${stackedTableGap}px`,
				"--tabula-stacked-table-divider-offset": `${-stackedTableGap / 2}px`,
			} as CSSProperties}
		>
			<div className="tabula-file-controls">
				<span className="tabula-file-count">
					{file.tables.length} {file.tables.length === 1 ? "table" : "tables"} in this file
				</span>
				<button className="tabula-btn tabula-btn-primary" type="button" onClick={showAddTableMenu}>
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
			{stackedImportCandidate && (
				<PasteSpreadsheetModal
					mode="stacked"
					matrix={stackedImportCandidate.matrix}
					sourceName={stackedImportCandidate.sourceName}
					onClose={() => setStackedImportCandidate(null)}
					onCreateStacked={createStackedFromPreview}
				/>
			)}
		</div>
	);
}
