import { useEffect, useMemo, useRef, useState } from "react";
import {
	CellValue,
	MultiSelectField,
	SelectOption,
	SingleSelectField,
} from "../data/types";

interface Props {
	field: SingleSelectField | MultiSelectField;
	value: CellValue;
	onChange: (value: CellValue) => void;
	onAddOption: (name: string) => SelectOption;
	onManageOptions: () => void;
}

export function SelectEditor({
	field,
	value,
	onChange,
	onAddOption,
	onManageOptions,
}: Props) {
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);

	const selectedIds: string[] =
		field.type === "singleSelect"
			? typeof value === "string"
				? [value]
				: []
			: Array.isArray(value)
				? value
				: [];

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return field.options;
		return field.options.filter((o) => o.name.toLowerCase().includes(needle));
	}, [field.options, q]);

	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) {
				setOpen(false);
				setQ("");
			}
		};
		activeDocument.addEventListener("mousedown", onDoc);
		return () => activeDocument.removeEventListener("mousedown", onDoc);
	}, []);

	const toggle = (optionId: string) => {
		if (field.type === "singleSelect") {
			onChange(selectedIds[0] === optionId ? null : optionId);
			setOpen(false);
			setQ("");
			return;
		}
		const next = selectedIds.includes(optionId)
			? selectedIds.filter((id) => id !== optionId)
			: [...selectedIds, optionId];
		onChange(next);
	};

	const createAndSelect = () => {
		const name = q.trim();
		if (!name) return;
		const existing = field.options.find(
			(o) => o.name.toLowerCase() === name.toLowerCase()
		);
		const option = existing ?? onAddOption(name);
		if (field.type === "singleSelect") {
			onChange(option.id);
			setOpen(false);
			setQ("");
		} else {
			const next = selectedIds.includes(option.id)
				? selectedIds
				: [...selectedIds, option.id];
			onChange(next);
			setQ("");
		}
	};

	return (
		<div className="tabula-select" ref={rootRef}>
			<button
				type="button"
				className="tabula-select-trigger"
				onClick={() => setOpen((v) => !v)}
			>
				{selectedIds.length === 0 ? (
					<span className="tabula-placeholder">Select…</span>
				) : (
					<span className="tabula-pills">
						{selectedIds.map((id) => {
							const opt = field.options.find((o) => o.id === id);
							if (!opt) return null;
							return (
								<span
									key={id}
									className={`tabula-pill tabula-color-${opt.color}`}
								>
									{opt.name}
									{field.type === "multiSelect" && (
										<span
											className="tabula-pill-x"
											onClick={(e) => {
												e.stopPropagation();
												toggle(id);
											}}
										>
											×
										</span>
									)}
								</span>
							);
						})}
					</span>
				)}
			</button>
			{open && (
				<div className="tabula-select-menu">
					<input
						className="tabula-select-search"
						autoFocus
						placeholder="Search or create…"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								if (filtered.length === 1) toggle(filtered[0].id);
								else createAndSelect();
							}
							if (e.key === "Escape") {
								setOpen(false);
								setQ("");
							}
						}}
					/>
					<div className="tabula-select-options">
						{filtered.map((opt) => {
							const active = selectedIds.includes(opt.id);
							return (
								<button
									key={opt.id}
									type="button"
									className={`tabula-select-option ${active ? "is-active" : ""}`}
									onClick={() => toggle(opt.id)}
								>
									<span className={`tabula-pill tabula-color-${opt.color}`}>
										{opt.name}
									</span>
									{active && <span className="tabula-check">✓</span>}
								</button>
							);
						})}
						{q.trim() &&
							!field.options.some(
								(o) => o.name.toLowerCase() === q.trim().toLowerCase()
							) && (
								<button
									type="button"
									className="tabula-select-option tabula-create-option"
									onClick={createAndSelect}
								>
									Create “{q.trim()}”
								</button>
							)}
					</div>
					<button
						type="button"
						className="tabula-select-manage"
						onClick={() => {
							setOpen(false);
							onManageOptions();
						}}
					>
						Manage options…
					</button>
				</div>
			)}
		</div>
	);
}
