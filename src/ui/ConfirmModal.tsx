import { useEffect } from "react";

interface Props {
	/** How many rows are about to be removed. */
	count: number;
	/** The table they belong to, used in the prompt. */
	tableName: string;
	onConfirm: () => void;
	onClose: () => void;
}

/**
 * Confirmation for a destructive bulk action. A custom dialog rather than
 * window.confirm(), which Obsidian's mobile WebView does not support.
 */
export function ConfirmModal(props: Props) {
	const { count, tableName, onConfirm, onClose } = props;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	const noun = count === 1 ? "row" : "rows";

	return (
		<div className="tabula-modal-backdrop" onClick={onClose}>
			<div
				className="tabula-modal tabula-confirm-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="tabula-confirm-title"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="tabula-modal-header">
					<h3 id="tabula-confirm-title">Delete {count} {noun}?</h3>
					<button
						className="tabula-btn tabula-icon-btn"
						type="button"
						aria-label="Close"
						onClick={onClose}
					>
						×
					</button>
				</div>

				<p className="tabula-confirm-text">
					This permanently removes {count} {noun} from{" "}
					<strong>{tableName}</strong>, together with every value in
					them. This cannot be undone.
				</p>

				<div className="tabula-confirm-actions">
					<button className="tabula-btn" type="button" onClick={onClose}>
						Cancel
					</button>
					<button
						className="tabula-btn tabula-btn-danger"
						type="button"
						autoFocus
						onClick={() => {
							onConfirm();
							onClose();
						}}
					>
						Delete {count} {noun}
					</button>
				</div>
			</div>
		</div>
	);
}
