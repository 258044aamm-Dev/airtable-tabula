export interface AirtableBase {
	id: string;
	name: string;
	permissionLevel: string;
}

export interface AirtableField {
	id: string;
	name: string;
	type: string;
	options?: {
		choices?: { id: string; name: string; color?: string }[];
		precision?: number;
		symbol?: string;
		max?: number;
	};
}

export interface AirtableTable {
	id: string;
	name: string;
	primaryFieldId: string;
	fields: AirtableField[];
}

export interface AirtableRecord {
	id: string;
	createdTime: string;
	fields: Record<string, unknown>;
}

export class AirtableApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
		this.name = "AirtableApiError";
	}
}

export class AirtableClient {
	constructor(private token: string) {}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await fetch(`https://api.airtable.com/v0${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${this.token}`,
				"Content-Type": "application/json",
				...(init.headers ?? {}),
			},
		});
		const text = await res.text();
		let body: unknown = null;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			body = text;
		}
		if (!res.ok) {
			const msg =
				typeof body === "object" &&
				body &&
				"error" in body &&
				typeof (body as { error?: { message?: string } }).error?.message === "string"
					? (body as { error: { message: string } }).error.message
					: `Airtable error ${res.status}`;
			throw new AirtableApiError(res.status, msg);
		}
		return body as T;
	}

	async listBases(): Promise<AirtableBase[]> {
		const bases: AirtableBase[] = [];
		let offset: string | undefined;
		do {
			const q = offset ? `?offset=${encodeURIComponent(offset)}` : "";
			const page = await this.request<{ bases: AirtableBase[]; offset?: string }>(
				`/meta/bases${q}`
			);
			bases.push(...page.bases);
			offset = page.offset;
		} while (offset);
		return bases;
	}

	async getTables(baseId: string): Promise<AirtableTable[]> {
		const data = await this.request<{ tables: AirtableTable[] }>(
			`/meta/bases/${baseId}/tables`
		);
		return data.tables;
	}

	async listRecords(baseId: string, tableId: string): Promise<AirtableRecord[]> {
		const records: AirtableRecord[] = [];
		let offset: string | undefined;
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);
			const page = await this.request<{ records: AirtableRecord[]; offset?: string }>(
				`/${baseId}/${tableId}?${params.toString()}`
			);
			records.push(...page.records);
			offset = page.offset;
		} while (offset);
		return records;
	}

	async createRecords(
		baseId: string,
		tableId: string,
		records: { fields: Record<string, unknown> }[]
	): Promise<AirtableRecord[]> {
		const created: AirtableRecord[] = [];
		for (let i = 0; i < records.length; i += 10) {
			const chunk = records.slice(i, i + 10);
			const page = await this.request<{ records: AirtableRecord[] }>(
				`/${baseId}/${tableId}`,
				{
					method: "POST",
					body: JSON.stringify({ records: chunk, typecast: true }),
				}
			);
			created.push(...page.records);
		}
		return created;
	}

	async updateRecords(
		baseId: string,
		tableId: string,
		records: { id: string; fields: Record<string, unknown> }[]
	): Promise<AirtableRecord[]> {
		const updated: AirtableRecord[] = [];
		for (let i = 0; i < records.length; i += 10) {
			const chunk = records.slice(i, i + 10);
			const page = await this.request<{ records: AirtableRecord[] }>(
				`/${baseId}/${tableId}`,
				{
					method: "PATCH",
					body: JSON.stringify({ records: chunk, typecast: true }),
				}
			);
			updated.push(...page.records);
		}
		return updated;
	}
}
