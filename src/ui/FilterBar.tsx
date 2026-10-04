import { useState } from "react";
import {
	FilterCondition,
	FilterGroup,
	TableDocument,
	isNumericField,
	isSelectField,
} from "../data/types";
import { createId } from "../data/store";
import { operatorLabel, operatorsForField } from "../data/query";
import { MenuSelect } from "./MenuSelect";

interface Props {
	doc: TableDocument;
	queryError?: string;
	onQueryChange: (query: string) => void;
	onFiltersChange: (filters: FilterGroup) => void;
}

export function FilterBar({
	doc,
	queryError,
	onQueryChange,
	onFiltersChange,
}: Props) {
	const { filters, query } = doc.view;
	const [mode, setMode] = useState<"builder" | "query">("builder");

	const updateCondition = (id: string, patch: Partial<FilterCondition>) => {
		onFiltersChange({
			...filters,
			conditions: filters.conditions.map((c) =>
				c.id === id ? { ...c, ...patch } : c
			),
		});
	};

	const addCondition = () => {
		const field = doc.fields[0];
		if (!field) return;
		const ops = operatorsForField(field);
		onFiltersChange({
			...filters,
			conditions: [
				...filters.conditions,
				{
					id: createId("c"),
					fieldId: field.id,
					operator: ops[0],
					value: "",
				},
			],
		});
	};

	const removeCondition = (id: string) => {
		onFiltersChange({
			...filters,
			conditions: filters.conditions.filter((c) => c.id !== id),
		});
	};

	return (
		<div className="tabula-filter-bar">
			<div className="tabula-filter-mode-header">
				<div className="tabula-filter-tabs">
					<button
						type="button"
						className={`tabula-filter-tab ${mode === "builder" ? "is-active" : ""}`}
						onClick={() => setMode("builder")}
					>
						Condition Builder
						{filters.conditions.length > 0 && ` (${filters.conditions.length})`}
					</button>
					<button
						type="button"
						className={`tabula-filter-tab ${mode === "query" ? "is-active" : ""}`}
						onClick={() => setMode("query")}
					>
						Query Syntax
					</button>
				</div>
			</div>

			{mode === "query" ? (
				<div className="tabula-query-section">
					<div className="tabula-query-row">
						<input
							className={`tabula-query-input ${queryError ? "has-error" : ""}`}
							value={query}
							placeholder='e.g. status:Done tags:urgent,design name:~ship'
							onChange={(e) => onQueryChange(e.target.value)}
							spellCheck={false}
							aria-label="Filter query string"
						/>
						{queryError && <span className="tabula-query-error">{queryError}</span>}
					</div>
					<div className="tabula-query-tips">
						<span className="tabula-query-tip-label">Syntax:</span>
						<code>field:value</code>
						<code>name:~text</code>
						<code>num:&gt;10</code>
						<code>status:!Done</code>
						<code>tags:a,b</code>
						<code>field:empty</code>
					</div>
				</div>
			) : (
				<div className="tabula-builder-section">
					<div className="tabula-filter-controls">
						<MenuSelect
							value={filters.logic}
							ariaLabel="Filter logic"
							onChange={(logic) =>
								onFiltersChange({
									...filters,
									logic: logic === "or" ? "or" : "and",
								})
							}
							options={[
								{ value: "and", label: "Match all (AND)" },
								{ value: "or", label: "Match any (OR)" },
							]}
						/>
						<button className="tabula-btn tabula-btn-primary" type="button" onClick={addCondition}>
							+ Condition
						</button>
						{filters.conditions.length > 0 && (
							<button
								className="tabula-btn"
								type="button"
								onClick={() =>
									onFiltersChange({ logic: filters.logic, conditions: [] })
								}
							>
								Clear all
							</button>
						)}
					</div>

					{filters.conditions.length === 0 ? (
						<div className="tabula-filter-empty">
							No conditions applied. Click <strong>+ Condition</strong> above to filter rows.
						</div>
					) : (
						<div className="tabula-conditions">
							{filters.conditions.map((condition) => {
								const field = doc.fields.find((f) => f.id === condition.fieldId);
								const ops = field ? operatorsForField(field) : [];
								const needsValue = !["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(
									condition.operator
								);

								return (
									<div className="tabula-condition" key={condition.id}>
										<MenuSelect
											value={condition.fieldId}
											ariaLabel="Filter field"
											onChange={(fieldId) => {
												const nextField = doc.fields.find((f) => f.id === fieldId);
												const nextOps = nextField ? operatorsForField(nextField) : [];
												updateCondition(condition.id, {
													fieldId,
													operator: nextOps[0],
													value: "",
												});
											}}
											options={doc.fields.map((f) => ({ value: f.id, label: f.name }))}
										/>
										<MenuSelect
											value={condition.operator}
											ariaLabel="Filter operator"
											onChange={(operator) =>
												updateCondition(condition.id, {
													operator: operator as FilterCondition["operator"],
												})
											}
											options={ops.map((op) => ({
												value: op,
												label: operatorLabel(op),
											}))}
										/>
										{needsValue && field && (
											<ConditionValueInput
												field={field}
												condition={condition}
												onChange={(value) => updateCondition(condition.id, { value })}
											/>
										)}
										<button
											className="tabula-btn tabula-icon-btn is-danger"
											type="button"
											onClick={() => removeCondition(condition.id)}
											aria-label="Remove condition"
											title="Remove condition"
										>
											×
										</button>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function ConditionValueInput({
	field,
	condition,
	onChange,
}: {
	field: TableDocument["fields"][number];
	condition: FilterCondition;
	onChange: (value: FilterCondition["value"]) => void;
}) {
	if (field.type === "singleSelect" || field.type === "multiSelect") {
		if (
			condition.operator === "isAnyOf" ||
			condition.operator === "containsAny" ||
			condition.operator === "containsAll"
		) {
			const selected = Array.isArray(condition.value) ? condition.value : [];
			return (
				<div className="tabula-multi-filter">
					{field.options.map((opt) => {
						const checked = selected.includes(opt.id);
						return (
							<label key={opt.id} className="tabula-check-label">
								<input
									type="checkbox"
									checked={checked}
									onChange={() => {
										onChange(
											checked
												? selected.filter((id) => id !== opt.id)
												: [...selected, opt.id]
										);
									}}
								/>
								{opt.name}
							</label>
						);
					})}
				</div>
			);
		}
		return (
			<MenuSelect
				value={typeof condition.value === "string" ? condition.value : ""}
				ariaLabel="Filter value"
				onChange={(v) => onChange(v)}
				options={[
					{ value: "", label: "Select…" },
					...field.options.map((opt) => ({ value: opt.id, label: opt.name })),
				]}
			/>
		);
	}

	if (isNumericField(field)) {
		return (
			<input
				type="number"
				value={typeof condition.value === "number" ? condition.value : ""}
				onChange={(e) =>
					onChange(e.target.value === "" ? null : Number(e.target.value))
				}
			/>
		);
	}

	if (field.type === "date") {
		return (
			<input
				type="date"
				value={typeof condition.value === "string" ? condition.value : ""}
				onChange={(e) => onChange(e.target.value)}
			/>
		);
	}

	if (
		field.type === "datetime" ||
		field.type === "createdTime" ||
		field.type === "lastModifiedTime"
	) {
		return (
			<input
				type="datetime-local"
				value={
					typeof condition.value === "string" && condition.value
						? condition.value.slice(0, 16)
						: ""
				}
				onChange={(e) =>
					onChange(e.target.value ? new Date(e.target.value).toISOString() : "")
				}
			/>
		);
	}

	if (isSelectField(field)) {
		return null;
	}

	return (
		<input
			type="text"
			value={typeof condition.value === "string" ? condition.value : ""}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
}
