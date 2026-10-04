import { useEffect, useState } from "react";
import { AirtableBase, AirtableClient, AirtableTable } from "../sync/airtableClient";
import { createLinkConfig } from "../sync/syncEngine";
import { TableDocument } from "../data/types";

interface Props {
	token: string;
	doc: TableDocument;
	onClose: () => void;
	onLinked: (doc: TableDocument) => void;
}

export function LinkSyncModal({ token, doc, onClose, onLinked }: Props) {
	const [bases, setBases] = useState<AirtableBase[]>([]);
	const [tables, setTables] = useState<AirtableTable[]>([]);
	const [baseId, setBaseId] = useState(doc.sync?.baseId ?? "");
	const [tableId, setTableId] = useState(doc.sync?.tableId ?? "");
	const [replaceSchema, setReplaceSchema] = useState(!doc.fields.length || doc.rows.length === 0);
	const [loading, setLoading] = useState(true);
	const [loadingTables, setLoadingTables] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const client = new AirtableClient(token);
				const list = await client.listBases();
				if (!cancelled) {
					setBases(list);
					setLoading(false);
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to list bases");
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [token]);

	useEffect(() => {
		if (!baseId) {
			setTables([]);
			return;
		}
		let cancelled = false;
		setLoadingTables(true);
		setError(null);
		void (async () => {
			try {
				const client = new AirtableClient(token);
				const list = await client.getTables(baseId);
				if (!cancelled) {
					setTables(list);
					setLoadingTables(false);
					if (!list.some((t) => t.id === tableId)) setTableId("");
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to list tables");
					setLoadingTables(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [baseId, token]);

	const link = async () => {
		const base = bases.find((b) => b.id === baseId);
		const table = tables.find((t) => t.id === tableId);
		if (!base || !table) {
			setError("Pick a base and table");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const { doc: next } = createLinkConfig(
				base.id,
				base.name,
				table,
				doc,
				replaceSchema
			);
			onLinked(next);
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to link");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="tabula-modal-backdrop" onClick={onClose}>
			<div
				className="tabula-modal"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="Link Airtable table"
			>
				<div className="tabula-modal-header">
					<h3>Link Airtable table</h3>
					<button className="tabula-btn" type="button" onClick={onClose}>
						Close
					</button>
				</div>

				{loading && <p className="tabula-muted">Loading bases…</p>}
				{error && <p className="tabula-query-error">{error}</p>}

				{!loading && (
					<div className="tabula-sync-form">
						<label className="tabula-sync-field">
							<span>Base</span>
							<select
								value={baseId}
								onChange={(e) => setBaseId(e.target.value)}
							>
								<option value="">Select base…</option>
								{bases.map((b) => (
									<option key={b.id} value={b.id}>
										{b.name}
									</option>
								))}
							</select>
						</label>
						<label className="tabula-sync-field">
							<span>Table</span>
							<select
								value={tableId}
								onChange={(e) => setTableId(e.target.value)}
								disabled={!baseId || loadingTables}
							>
								<option value="">
									{loadingTables ? "Loading…" : "Select table…"}
								</option>
								{tables.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
									</option>
								))}
							</select>
						</label>
						<label className="tabula-check-label">
							<input
								type="checkbox"
								checked={replaceSchema}
								onChange={(e) => setReplaceSchema(e.target.checked)}
							/>
							Replace local columns with Airtable schema (clears rows)
						</label>
						<p className="tabula-muted">
							Fields are matched by name. Pull after linking to import records.
						</p>
						<div className="tabula-panel-header">
							<button
								className="tabula-btn tabula-btn-primary"
								type="button"
								disabled={!baseId || !tableId || busy}
								onClick={() => void link()}
							>
								{busy ? "Linking…" : "Link table"}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
