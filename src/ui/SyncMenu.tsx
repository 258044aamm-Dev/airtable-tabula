import { useEffect, useRef, useState } from "react";
import { SyncConfig } from "../data/types";

interface Props {
	linked: boolean;
	sync: SyncConfig | null | undefined;
	busy: boolean;
	hasToken: boolean;
	onLink: () => void;
	onPull: () => void;
	onPush: () => void;
	onUnlink: () => void;
}

export function SyncMenu({
	linked,
	sync,
	busy,
	hasToken,
	onLink,
	onPull,
	onPush,
	onUnlink,
}: Props) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [open]);

	const label = linked
		? sync?.tableName
			? `Sync · ${sync.tableName}`
			: "Sync · Linked"
		: "Sync";

	return (
		<div className="tabula-menu-select" ref={ref}>
			<button
				type="button"
				className={`tabula-btn ${linked ? "is-active" : ""} ${busy ? "is-busy" : ""}`}
				aria-expanded={open}
				disabled={busy}
				onClick={() => setOpen((v) => !v)}
				title={
					hasToken
						? linked
							? "Airtable sync actions"
							: "Link this table to Airtable"
						: "Set an Airtable token in plugin settings first"
				}
			>
				{busy ? "Syncing…" : label}
				<span className="tabula-menu-chevron">▾</span>
			</button>
			{open && (
				<div className="tabula-menu-popover align-right" role="menu">
					{!hasToken && (
						<div className="tabula-menu-hint">
							Add a personal access token in Settings → Tabula.
						</div>
					)}
					{hasToken && !linked && (
						<button
							type="button"
							className="tabula-menu-option"
							onClick={() => {
								setOpen(false);
								onLink();
							}}
						>
							Link Airtable table…
						</button>
					)}
					{hasToken && linked && (
						<>
							<button
								type="button"
								className="tabula-menu-option"
								onClick={() => {
									setOpen(false);
									onPull();
								}}
							>
								Pull from Airtable
							</button>
							<button
								type="button"
								className="tabula-menu-option"
								onClick={() => {
									setOpen(false);
									onPush();
								}}
							>
								Push to Airtable
							</button>
							<button
								type="button"
								className="tabula-menu-option"
								onClick={() => {
									setOpen(false);
									onLink();
								}}
							>
								Change link…
							</button>
							<button
								type="button"
								className="tabula-menu-option is-danger"
								onClick={() => {
									setOpen(false);
									onUnlink();
								}}
							>
								Unlink
							</button>
							{(sync?.lastPulledAt || sync?.lastPushedAt) && (
								<div className="tabula-menu-hint">
									{sync.lastPulledAt && (
										<div>Pulled {new Date(sync.lastPulledAt).toLocaleString()}</div>
									)}
									{sync.lastPushedAt && (
										<div>Pushed {new Date(sync.lastPushedAt).toLocaleString()}</div>
									)}
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
