import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CellValue, Field, isReadOnlyField } from "../data/types";
import {
	formatDuration,
	parseDuration,
} from "../data/store";
import { SelectEditor } from "./SelectEditor";

interface Props {
	field: Field;
	value: CellValue;
	onChange: (value: CellValue) => void;
	onAddOption: (name: string) => { id: string; name: string; color: string };
	onManageOptions: () => void;
}

export function CellEditor(props: Props) {
	const { field, value, onChange } = props;

	if (field.type === "checkbox") {
		return (
			<label className="tabula-checkbox-cell">
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(e) => onChange(e.target.checked)}
				/>
			</label>
		);
	}

	if (field.type === "rating") {
		const max = field.max ?? 5;
		const current = typeof value === "number" ? value : 0;
		return (
			<div className="tabula-rating">
				{Array.from({ length: max }, (_, i) => {
					const n = i + 1;
					return (
						<button
							key={n}
							type="button"
							className={`tabula-star ${n <= current ? "is-on" : ""}`}
							onClick={() => onChange(current === n ? null : n)}
							aria-label={`${n} star`}
						>
							★
						</button>
					);
				})}
			</div>
		);
	}

	if (field.type === "singleSelect" || field.type === "multiSelect") {
		return (
			<SelectEditor
				field={field}
				value={value}
				onChange={onChange}
				onAddOption={props.onAddOption as never}
				onManageOptions={props.onManageOptions}
			/>
		);
	}

	if (field.type === "attachment") {
		return (
			<AttachmentCell
				value={Array.isArray(value) ? value : []}
				onChange={onChange}
			/>
		);
	}

	if (field.type === "longText") {
		return (
			<LongTextCell
				value={typeof value === "string" ? value : ""}
				onChange={onChange}
			/>
		);
	}

	if (isReadOnlyField(field)) {
		return (
			<span className="tabula-readonly">
				{formatReadOnly(field, value)}
			</span>
		);
	}

	if (field.type === "number" || field.type === "currency" || field.type === "percent") {
		return (
			<div className="tabula-affix-cell">
				{field.type === "currency" && (
					<span className="tabula-affix">{field.symbol ?? "$"}</span>
				)}
				<input
					className="tabula-cell-input"
					type="number"
					value={typeof value === "number" ? value : ""}
					onChange={(e) =>
						onChange(e.target.value === "" ? null : Number(e.target.value))
					}
					onKeyDown={navKeys}
				/>
				{field.type === "percent" && <span className="tabula-affix">%</span>}
			</div>
		);
	}

	if (field.type === "duration") {
		return (
			<input
				className="tabula-cell-input"
				type="text"
				placeholder="h:mm:ss"
				defaultValue={formatDuration(typeof value === "number" ? value : null)}
				key={String(value)}
				onBlur={(e) => onChange(parseDuration(e.target.value))}
				onKeyDown={(e) => {
					if (e.key === "Enter") (e.target as HTMLInputElement).blur();
					navKeys(e);
				}}
			/>
		);
	}

	if (field.type === "date") {
		return (
			<input
				className="tabula-cell-input"
				type="date"
				value={typeof value === "string" ? value.slice(0, 10) : ""}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={navKeys}
			/>
		);
	}

	if (field.type === "datetime") {
		const local =
			typeof value === "string" && value
				? toDatetimeLocal(value)
				: "";
		return (
			<input
				className="tabula-cell-input"
				type="datetime-local"
				value={local}
				onChange={(e) =>
					onChange(e.target.value ? new Date(e.target.value).toISOString() : "")
				}
				onKeyDown={navKeys}
			/>
		);
	}

	if (field.type === "url" || field.type === "email") {
		return (
			<LinkTextCell
				kind={field.type}
				value={typeof value === "string" ? value : ""}
				onChange={onChange}
			/>
		);
	}

	return (
		<TextCell
			value={typeof value === "string" ? value : ""}
			onChange={onChange}
		/>
	);
}

function formatReadOnly(field: Field, value: CellValue): string {
	if (field.type === "autoNumber") {
		return value == null ? "" : String(value);
	}
	if (typeof value === "string" && value) {
		try {
			return new Date(value).toLocaleString();
		} catch {
			return value;
		}
	}
	return "";
}

function toDatetimeLocal(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function navKeys(e: KeyboardEvent) {
	if (e.key === "Enter" && !(e.target as HTMLElement).closest("textarea")) {
		(e.target as HTMLInputElement).blur();
	}
}

function TextCell({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	const focused = useRef(false);
	useEffect(() => {
		if (!focused.current) setDraft(value);
	}, [value]);

	return (
		<input
			className="tabula-cell-input"
			type="text"
			value={draft}
			onFocus={() => {
				focused.current = true;
			}}
			onBlur={() => {
				focused.current = false;
				onChange(draft);
			}}
			onChange={(e) => setDraft(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					setDraft(value);
					(e.target as HTMLInputElement).blur();
					return;
				}
				if (e.key === "Enter") (e.target as HTMLInputElement).blur();
			}}
		/>
	);
}

function LongTextCell({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	const [expanded, setExpanded] = useState(false);
	useEffect(() => setDraft(value), [value]);

	if (!expanded) {
		return (
			<button
				type="button"
				className="tabula-longtext-preview"
				onClick={() => setExpanded(true)}
			>
				{value || <span className="tabula-placeholder">Add text…</span>}
			</button>
		);
	}

	return (
		<textarea
			className="tabula-longtext"
			autoFocus
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => {
				onChange(draft);
				setExpanded(false);
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					setDraft(value);
					setExpanded(false);
				}
			}}
		/>
	);
}

function LinkTextCell({
	kind,
	value,
	onChange,
}: {
	kind: "url" | "email";
	value: string;
	onChange: (value: string) => void;
}) {
	const [editing, setEditing] = useState(!value);
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);

	if (!editing && value) {
		const href = kind === "email" ? `mailto:${value}` : value;
		return (
			<div className="tabula-link-cell">
				<a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
					{value}
				</a>
				<button type="button" className="tabula-btn tabula-icon-btn" onClick={() => setEditing(true)}>
					✎
				</button>
			</div>
		);
	}

	return (
		<input
			className="tabula-cell-input"
			type={kind === "email" ? "email" : "url"}
			value={draft}
			autoFocus={editing}
			placeholder={kind === "email" ? "name@example.com" : "https://"}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => {
				onChange(draft);
				setEditing(false);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter") (e.target as HTMLInputElement).blur();
				if (e.key === "Escape") {
					setDraft(value);
					setEditing(false);
				}
			}}
		/>
	);
}

function AttachmentCell({
	value,
	onChange,
}: {
	value: string[];
	onChange: (value: CellValue) => void;
}) {
	const [draft, setDraft] = useState("");

	const add = () => {
		const path = draft.trim();
		if (!path) return;
		if (value.includes(path)) {
			setDraft("");
			return;
		}
		onChange([...value, path]);
		setDraft("");
	};

	return (
		<div className="tabula-attachments">
			{value.map((path) => (
				<span key={path} className="tabula-attach-chip" title={path}>
					{path.split("/").pop()}
					<button
						type="button"
						className="tabula-pill-x"
						onClick={() => onChange(value.filter((p) => p !== path))}
					>
						×
					</button>
				</span>
			))}
			<input
				className="tabula-cell-input tabula-attach-input"
				placeholder="vault/path.ext"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						add();
					}
				}}
				onBlur={add}
			/>
		</div>
	);
}
