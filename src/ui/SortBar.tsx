import { SortSpec, TableDocument } from "../data/types";
import { MenuSelect } from "./MenuSelect";

interface Props {
	doc: TableDocument;
	onChange: (sorts: SortSpec[]) => void;
}

export function SortBar({ doc, onChange }: Props) {
	const { sorts } = doc.view;

	const update = (index: number, patch: Partial<SortSpec>) => {
		onChange(sorts.map((s, i) => (i === index ? { ...s, ...patch } : s)));
	};

	const add = () => {
		const field =
			doc.fields.find((f) => !sorts.some((s) => s.fieldId === f.id)) ?? doc.fields[0];
		if (!field) return;
		onChange([...sorts, { fieldId: field.id, direction: "asc" }]);
	};

	return (
		<div className="tabula-panel">
			<div className="tabula-panel-header">
				<strong>Sort</strong>
				<button className="tabula-btn" type="button" onClick={add}>
					+ Sort
				</button>
				{sorts.length > 0 && (
					<button className="tabula-btn" type="button" onClick={() => onChange([])}>
						Clear
					</button>
				)}
			</div>
			{sorts.length === 0 && (
				<div className="tabula-panel-empty">No sorts — click + Sort or use a column menu.</div>
			)}
			{sorts.map((sort, index) => (
				<div className="tabula-condition" key={`${sort.fieldId}-${index}`}>
					<MenuSelect
						value={sort.fieldId}
						ariaLabel="Sort field"
						onChange={(fieldId) => update(index, { fieldId })}
						options={doc.fields.map((f) => ({ value: f.id, label: f.name }))}
					/>
					<MenuSelect
						value={sort.direction}
						ariaLabel="Sort direction"
						onChange={(direction) =>
							update(index, { direction: direction === "desc" ? "desc" : "asc" })
						}
						options={[
							{ value: "asc", label: "A → Z" },
							{ value: "desc", label: "Z → A" },
						]}
					/>
					<button
						className="tabula-btn tabula-icon-btn"
						type="button"
						onClick={() => onChange(sorts.filter((_, i) => i !== index))}
					>
						×
					</button>
				</div>
			))}
		</div>
	);
}
