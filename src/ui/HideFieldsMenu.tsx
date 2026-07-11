import { TableDocument } from "../data/types";

interface Props {
	doc: TableDocument;
	onChange: (hiddenFieldIds: string[]) => void;
}

export function HideFieldsMenu({ doc, onChange }: Props) {
	const hidden = new Set(doc.view.hiddenFieldIds);

	const toggle = (fieldId: string) => {
		if (hidden.has(fieldId)) {
			onChange(doc.view.hiddenFieldIds.filter((id) => id !== fieldId));
		} else {
			onChange([...doc.view.hiddenFieldIds, fieldId]);
		}
	};

	return (
		<div className="tabula-panel">
			<div className="tabula-panel-header">
				<strong>Hide fields</strong>
				<button
					className="tabula-btn"
					type="button"
					onClick={() => onChange([])}
					disabled={hidden.size === 0}
				>
					Show all
				</button>
			</div>
			<div className="tabula-hide-list">
				{doc.fields.map((f) => (
					<label key={f.id} className="tabula-check-label">
						<input
							type="checkbox"
							checked={!hidden.has(f.id)}
							onChange={() => toggle(f.id)}
						/>
						{f.name}
						<span className="tabula-muted">({f.type})</span>
					</label>
				))}
			</div>
		</div>
	);
}
