import { useEffect, useRef, useState } from "react";

export interface MenuOption {
	value: string;
	label: string;
	disabled?: boolean;
}

interface Props {
	label?: string;
	value: string;
	options: MenuOption[];
	onChange: (value: string) => void;
	title?: string;
	ariaLabel?: string;
	className?: string;
	/** Button-style trigger (for + Field) instead of labeled control */
	variant?: "control" | "button" | "button-primary";
	triggerLabel?: string;
	align?: "left" | "right";
}

export function MenuSelect({
	label,
	value,
	options,
	onChange,
	title,
	ariaLabel,
	className = "",
	variant = "control",
	triggerLabel,
	align = "left",
}: Props) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const selected = options.find((o) => o.value === value);
	const display =
		triggerLabel ??
		(variant === "control"
			? selected?.label ?? "…"
			: triggerLabel ?? selected?.label ?? "…");

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const triggerClass =
		variant === "control"
			? "tabula-menu-trigger"
			: variant === "button-primary"
				? "tabula-btn tabula-btn-primary tabula-menu-btn"
				: "tabula-btn tabula-menu-btn";

	return (
		<div
			className={`tabula-menu-select ${className}`}
			ref={rootRef}
			title={title}
		>
			{variant === "control" ? (
				<button
					type="button"
					className={`tabula-inline-control ${triggerClass}`}
					aria-label={ariaLabel ?? label}
					aria-expanded={open}
					aria-haspopup="listbox"
					onClick={() => setOpen((v) => !v)}
				>
					{label && <span className="tabula-menu-label">{label}</span>}
					<span className="tabula-menu-value">{display}</span>
					<span className="tabula-menu-chevron" aria-hidden="true">
						▾
					</span>
				</button>
			) : (
				<button
					type="button"
					className={triggerClass}
					aria-label={ariaLabel ?? triggerLabel}
					aria-expanded={open}
					aria-haspopup="listbox"
					onClick={() => setOpen((v) => !v)}
				>
					{display}
					<span className="tabula-menu-chevron" aria-hidden="true">
						▾
					</span>
				</button>
			)}
			{open && (
				<div
					className={`tabula-menu-popover align-${align}`}
					role="listbox"
					aria-label={ariaLabel ?? label}
				>
					{options.map((opt) => (
						<button
							key={opt.value || "__empty"}
							type="button"
							role="option"
							aria-selected={opt.value === value}
							disabled={opt.disabled}
							className={`tabula-menu-option ${opt.value === value ? "is-selected" : ""}`}
							onClick={() => {
								if (opt.disabled) return;
								onChange(opt.value);
								setOpen(false);
							}}
						>
							{opt.label}
							{opt.value === value && (
								<span className="tabula-menu-check" aria-hidden="true">
									✓
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
