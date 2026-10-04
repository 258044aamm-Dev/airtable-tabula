import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CellValue, Field, RatingField, isReadOnlyField } from "../data/types";
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
		return <RatingCell field={field} value={value} onChange={onChange} />;
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
					className="tabula-cell-input tabula-number-input"
					type="number"
					value={typeof value === "number" ? value : ""}
					onChange={(e) =>
						onChange(e.target.value === "" ? null : Number(e.target.value))
					}
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
				onChange={(e) => {
					if (!e.target.value) {
						onChange("");
						return;
					}
					const parsed = new Date(e.target.value);
					if (!Number.isNaN(parsed.getTime())) {
						onChange(parsed.toISOString());
					}
				}}
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

	if (field.type === "phone") {
		return (
			<input
				className="tabula-cell-input"
				type="tel"
				placeholder="(555) 000-0000"
				value={typeof value === "string" ? value : ""}
				onChange={(e) => onChange(e.target.value)}
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

function RatingCell({
	field,
	value,
	onChange,
}: {
	field: RatingField;
	value: CellValue;
	onChange: (value: CellValue) => void;
}) {
	const max = field.max ?? 5;
	const current = typeof value === "number" ? value : 0;
	const [hoverRating, setHoverRating] = useState<number | null>(null);

	const activeStars = hoverRating ?? current;

	return (
		<div className="tabula-rating" onMouseLeave={() => setHoverRating(null)}>
			{Array.from({ length: max }, (_, i) => {
				const n = i + 1;
				return (
					<button
						key={n}
						type="button"
						tabIndex={-1}
						className={`tabula-star ${n <= activeStars ? "is-on" : ""}`}
						onMouseEnter={() => setHoverRating(n)}
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
				}
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
	const containerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => setDraft(value), [value]);

	useEffect(() => {
		if (!expanded) return;
		const onDoc = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) {
				onChange(draft);
				setExpanded(false);
			}
		};
		activeDocument.addEventListener("mousedown", onDoc);
		return () => activeDocument.removeEventListener("mousedown", onDoc);
	}, [expanded, draft, onChange]);

	const commitAndClose = () => {
		onChange(draft);
		setExpanded(false);
	};

	return (
		<div className="tabula-longtext-wrapper" ref={containerRef}>
			<button
				type="button"
				className={`tabula-longtext-preview ${expanded ? "is-active" : ""}`}
				onClick={() => setExpanded(true)}
			>
				{value || <span className="tabula-placeholder">Add text…</span>}
			</button>
			{expanded && (
				<div className="tabula-longtext-popover" role="dialog" aria-label="Edit text">
					<textarea
						ref={textareaRef}
						className="tabula-longtext-input"
						autoFocus
						value={draft}
						placeholder="Type multiline text…"
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault();
								e.stopPropagation();
								setDraft(value);
								setExpanded(false);
							}
							if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
								e.preventDefault();
								commitAndClose();
							}
						}}
					/>
					<div className="tabula-longtext-popover-footer">
						<span className="tabula-muted tabula-longtext-count">
							{draft.length} chars · {draft.trim() ? draft.trim().split(/\s+/).length : 0} words
						</span>
						<div className="tabula-longtext-actions">
							<span className="tabula-muted tabula-shortcut-hint">Ctrl+Enter to save</span>
							<button
								type="button"
								className="tabula-btn tabula-btn-primary"
								onClick={commitAndClose}
							>
								Done
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
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
		const href = kind === "email" ? `mailto:${value}` : value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
		return (
			<div className="tabula-link-cell" onDoubleClick={() => setEditing(true)}>
				<a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
					{value}
				</a>
				<button
					type="button"
					className="tabula-btn tabula-icon-btn"
					onClick={() => setEditing(true)}
					title="Edit link"
				>
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
						title="Remove attachment"
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
