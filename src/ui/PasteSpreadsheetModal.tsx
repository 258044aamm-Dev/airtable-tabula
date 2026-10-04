import { useMemo, useState } from "react";
import { TableDocument } from "../data/types";
import { matrixToTable } from "../import/spreadsheet";

interface Props {
	matrix: unknown[][];
	sourceName: string;
	currentDoc: TableDocument;
	onClose: () => void;
	onReplace: (incoming: TableDocument) => void;
	onAppend: (incoming: TableDocument) => void;
	onCreateNew: (incoming: TableDocument) => Promise<void>;
}

export function PasteSpreadsheetModal({
	matrix,
	sourceName,
	currentDoc,
	onClose,
	onReplace,
	onAppend,
	onCreateNew,
}: Props) {
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
		setError("");
		try {
			const incoming = buildIncoming();
			if (currentDoc.sync) {
				setReplaceCandidate(incoming);
				setConfirmReplace(true);
				return;
			}
			onReplace(incoming);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read spreadsheet data");
		}
	};

	const confirmReplacement = () => {
		if (!replaceCandidate) return;
		onReplace(replaceCandidate);
		setReplaceCandidate(null);
		setConfirmReplace(false);
	};

	const handleAppend = () => {
		setError("");
		try {
			onAppend(buildIncoming());
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read spreadsheet data");
		}
	};

	const handleCreate = async () => {
		setError("");
		setBusy(true);
		try {
			await onCreateNew(buildIncoming());
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not create a new table");
		} finally {
			setBusy(false);
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
						<h3 id="tabula-paste-title">Paste spreadsheet data</h3>
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

				{currentDoc.sync && (
					<div className="tabula-paste-warning">
						This table is linked to Airtable. Replacing it will unlink the table. Appended
						rows will be new local records; new columns will not be included in sync.
					</div>
				)}

				{confirmReplace ? (
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
