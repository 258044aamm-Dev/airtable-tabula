import { useState } from "react";
import {
	SELECT_COLORS,
	SelectColor,
	SelectOption,
	SingleSelectField,
	MultiSelectField,
} from "../data/types";
import { createSelectOption } from "../data/store";

type SelectField = SingleSelectField | MultiSelectField;

interface Props {
	field: SelectField;
	onClose: () => void;
	onChange: (field: SelectField) => void;
	onRemoveOption: (optionId: string) => void;
}

export function OptionManager({ field, onClose, onChange, onRemoveOption }: Props) {
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const updateOption = (optionId: string, patch: Partial<SelectOption>) => {
		onChange({
			...field,
			options: field.options.map((o) =>
				o.id === optionId ? { ...o, ...patch } : o
			),
		});
	};

	const addOption = () => {
		onChange({
			...field,
			options: [
				...field.options,
				createSelectOption(`Option ${field.options.length + 1}`),
			],
		});
	};

	const move = (index: number, dir: -1 | 1) => {
		const next = index + dir;
		if (next < 0 || next >= field.options.length) return;
		const options = [...field.options];
		const tmp = options[index];
		options[index] = options[next];
		options[next] = tmp;
		onChange({ ...field, options });
	};

	return (
		<div className="tabula-modal-backdrop" onClick={onClose}>
			<div
				className="tabula-modal"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="Manage options"
			>
				<div className="tabula-modal-header">
					<h3>Options — {field.name}</h3>
					<button className="tabula-btn" type="button" onClick={onClose}>
						Close
					</button>
				</div>
				<div className="tabula-option-list">
					{field.options.map((opt, index) => (
						<div className="tabula-option-row" key={opt.id}>
							<span className={`tabula-pill tabula-color-${opt.color}`}>
								{opt.name}
							</span>
							<input
								type="text"
								value={opt.name}
								onChange={(e) => updateOption(opt.id, { name: e.target.value })}
							/>
							<select
								value={opt.color}
								onChange={(e) =>
									updateOption(opt.id, {
										color: e.target.value as SelectColor,
									})
								}
							>
								{SELECT_COLORS.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</select>
							<button
								className="tabula-btn tabula-icon-btn"
								type="button"
								onClick={() => move(index, -1)}
								title="Move up"
							>
								↑
							</button>
							<button
								className="tabula-btn tabula-icon-btn"
								type="button"
								onClick={() => move(index, 1)}
								title="Move down"
							>
								↓
							</button>
							{pendingDeleteId === opt.id ? (
								<>
									<button
										className="tabula-btn tabula-icon-btn is-danger"
										type="button"
										title="Confirm delete"
										onClick={() => {
											onRemoveOption(opt.id);
											setPendingDeleteId(null);
										}}
									>
										✓
									</button>
									<button
										className="tabula-btn tabula-icon-btn"
										type="button"
										title="Cancel"
										onClick={() => setPendingDeleteId(null)}
									>
										↩
									</button>
								</>
							) : (
								<button
									className="tabula-btn tabula-icon-btn"
									type="button"
									title="Delete option"
									onClick={() => setPendingDeleteId(opt.id)}
								>
									×
								</button>
							)}
						</div>
					))}
				</div>
				<button className="tabula-btn" type="button" onClick={addOption}>
					+ Add option
				</button>
			</div>
		</div>
	);
}
