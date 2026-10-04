import { useMemo, useState } from "react";
import { TableDocument } from "../data/types";
import { matrixToTable } from "../import/spreadsheet";

interface SharedProps {
	matrix: unknown[][];
	sourceName: string;
	onClose: () => void;
}

interface TablePasteProps extends SharedProps {
	mode?: "table";
	currentDoc: TableDocument;
	onReplace: (incoming: TableDocument) => void;
	onAppend: (incoming: TableDocument) => void;
	onCreateNew: (incoming: TableDocument) => Promise<void>;
}

interface StackedTableProps extends SharedProps {
	mode: "stacked";
	onCreateStacked: (incoming: TableDocument) => Promise<void>;
}

type Props = TablePasteProps | StackedTableProps;

export function PasteSpreadsheetModal(props: Props) {
	const { matrix, sourceName, onClose } = props;
	const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
	const [busy, setBusy] = useState(false);
	const [confirmReplace, setConfirmReplace] = useState(false);
	const [replaceCandidate, setReplaceCandidate] = useState<TableDocument | null>(null);
	const [error, setError] = useState("");

	const columnCount = useMemo(
		() => matrix.reduce((max, row) => Math.max(max, row.length), 0),
		[matrix]
	);
	const rowCount = useMemo(
		() =>
			matrix.filter((row) => row.some((cell) => String(cell ?? "").trim() !== "")).length -
			(firstRowIsHeader ? 1 : 0),
		[matrix, firstRowIsHeader]
	);
	const preview = matrix.slice(0, 6).map((row) =>
		Array.from({ length: Math.min(columnCount, 6) }, (_, index) => String(row[index] ?? ""))
	);

	const buildIncoming = (): TableDocument =>
		matrixToTable(matrix, sourceName, firstRowIsHeader);

	const handleReplace = () => {
		if (props.mode === "stacked") return;
		setError("");
		try {
			const incoming = buildIncoming();
			if (props.currentDoc.sync) {
				setReplaceCandidate(incoming);
				setConfirmReplace(true);
				return;
			}
			props.onReplace(incoming);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read spreadsheet data");
		}
	};

	const confirmReplacement = () => {
		if (!replaceCandidate || props.mode === "stacked") return;
		props.onReplace(replaceCandidate);
		setReplaceCandidate(null);
		setConfirmReplace(false);
	};

	const handleAppend = () => {
		if (props.mode === "stacked") return;
		setError("");
		try {
			props.onAppend(buildIncoming());
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read spreadsheet data");
		}
	};

	const handleCreate = async () => {
		setError("");
		setBusy(true);
		let stackedTableCreated = false;
		try {
			const incoming = buildIncoming();
			if (props.mode === "stacked") {
				await props.onCreateStacked(incoming);
				stackedTableCreated = true;
				props.onClose();
			} else {
				await props.onCreateNew(incoming);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not create a new table");
		} finally {
			if (!stackedTableCreated) setBusy(false);
		}
	};

	return (
		<div className="tabula-modal-backdrop" onClick={onClose}>
			<div
				className="tabula-modal tabula-paste-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="tabula-paste-title"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="tabula-modal-header">
					<div>
						<h3 id="tabula-paste-title">
							{props.mode === "stacked" ? "Create stacked table" : "Paste spreadsheet data"}
						</h3>
						<div className="tabula-muted tabula-paste-source">
							{sourceName} · {Math.max(0, rowCount)} rows · {columnCount} columns
						</div>
					</div>
					<button
						className="tabula-btn tabula-icon-btn"
						type="button"
						aria-label="Close paste preview"
						onClick={onClose}
					>
						×
					</button>
				</div>

				<label className="tabula-paste-header-toggle">
					<input
						type="checkbox"
						checked={firstRowIsHeader}
						disabled={confirmReplace}
						onChange={(event) => setFirstRowIsHeader(event.target.checked)}
					/>
					First row contains column names
				</label>

				<div className="tabula-paste-preview-wrap">
					<table className="tabula-paste-preview">
						<tbody>
							{preview.map((row, rowIndex) => (
								<tr
									key={rowIndex}
									className={firstRowIsHeader && rowIndex === 0 ? "is-header" : undefined}
								>
									{row.map((cell, cellIndex) =>
										firstRowIsHeader && rowIndex === 0 ? (
											<th key={cellIndex}>{cell || `Column ${cellIndex + 1}`}</th>
										) : (
											<td key={cellIndex}>{cell}</td>
										)
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{props.mode !== "stacked" && props.currentDoc.sync && (
					<div className="tabula-paste-warning">
						This table is linked to Airtable. Replacing it will unlink the table. Appended
						rows will be new local records; new columns will not be included in sync.
					</div>
				)}

				{props.mode === "stacked" ? (
					<div className="tabula-paste-actions">
						<button
							className="tabula-btn tabula-btn-primary"
							type="button"
							disabled={busy}
							onClick={() => void handleCreate()}
						>
							{busy ? "Adding…" : "Create stacked table"}
						</button>
					</div>
				) : confirmReplace ? (
					<div className="tabula-paste-confirm">
						<strong>Replace this table and unlink Airtable?</strong>
						<span>
							The imported columns and rows will replace the current data. This cannot be
							undone from this dialog.
						</span>
						<div className="tabula-paste-actions">
							<button className="tabula-btn" type="button" onClick={() => setConfirmReplace(false)}>
								Cancel
							</button>
							<button
								className="tabula-btn tabula-btn-primary"
								type="button"
								onClick={confirmReplacement}
							>
								Confirm replace
							</button>
						</div>
					</div>
				) : (
					<div className="tabula-paste-actions">
						<button className="tabula-btn" type="button" disabled={busy} onClick={handleReplace}>
							Replace current table
						</button>
						<button className="tabula-btn" type="button" disabled={busy} onClick={handleAppend}>
							Append to current table
						</button>
						<button
							className="tabula-btn tabula-btn-primary"
							type="button"
							disabled={busy}
							onClick={() => void handleCreate()}
						>
							{busy ? "Creating…" : "Create new table"}
						</button>
					</div>
				)}

				{error && <div className="tabula-paste-error">{error}</div>}
			</div>
		</div>
	);
}
