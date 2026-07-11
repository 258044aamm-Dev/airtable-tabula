import { useEffect, useRef, useState } from "react";
import { Field, isSelectField } from "../data/types";

interface Props {
	field: Field;
	onClose: () => void;
	onSortAsc: () => void;
	onSortDesc: () => void;
	onHide: () => void;
	onManageOptions: () => void;
	onInsertLeft: () => void;
	onInsertRight: () => void;
	onDelete: () => void;
}

export function FieldHeaderMenu(props: Props) {
	const ref = useRef<HTMLDivElement>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) props.onClose();
		};
		activeDocument.addEventListener("mousedown", onDoc);
		return () => activeDocument.removeEventListener("mousedown", onDoc);
	}, [props]);

	return (
		<div className="tabula-field-menu" ref={ref} role="menu">
			<button type="button" onClick={props.onSortAsc}>
				Sort A → Z
			</button>
			<button type="button" onClick={props.onSortDesc}>
				Sort Z → A
			</button>
			<button type="button" onClick={props.onHide}>
				Hide field
			</button>
			{isSelectField(props.field) && (
				<button type="button" onClick={props.onManageOptions}>
					Manage options…
				</button>
			)}
			<button type="button" onClick={props.onInsertLeft}>
				Insert left
			</button>
			<button type="button" onClick={props.onInsertRight}>
				Insert right
			</button>
			{confirmDelete ? (
				<>
					<button
						type="button"
						className="is-danger"
						onClick={props.onDelete}
					>
						Confirm delete
					</button>
					<button type="button" onClick={() => setConfirmDelete(false)}>
						Cancel
					</button>
				</>
			) : (
				<button
					type="button"
					className="is-danger"
					onClick={() => setConfirmDelete(true)}
				>
					Delete field
				</button>
			)}
		</div>
	);
}
