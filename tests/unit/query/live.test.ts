import { describe, expect, test } from "bun:test";
import { RecordId, Surreal, type SurrealSession, Table } from "surrealdb";
import { __display, displayContext, orm, t, table } from "../../../src";

function createMockLiveSession() {
	const handlers: Array<
		(message: {
			action: string;
			recordId: RecordId<string>;
			value: unknown;
		}) => void
	> = [];

	const subscription = {
		id: "live-subscription",
		subscribe: (
			handler: (message: {
				action: string;
				recordId: RecordId<string>;
				value: unknown;
			}) => void,
		) => {
			handlers.push(handler);
			return () => {
				const index = handlers.indexOf(handler);
				if (index >= 0) handlers.splice(index, 1);
			};
		},
		async *[Symbol.asyncIterator]() {},
		kill: () => Promise.resolve(),
	};

	return {
		surreal: {
			query: () => Promise.resolve(["live-subscription"]),
			liveOf: () => Promise.resolve(subscription),
		} as unknown as SurrealSession,
		emit(message: {
			action: string;
			recordId: RecordId<string>;
			value: unknown;
		}) {
			for (const handler of handlers) handler(message);
		},
	};
}

describe("LIVE SELECT queries", () => {
	const user = table("user", {
		name: t.object({
			first: t.string(),
			last: t.string(),
		}),
		age: t.number(),
		email: t.string(),
		tags: t.array(t.string()),
	});

	const post = table("post", {
		title: t.string(),
		body: t.string(),
		author: t.record("user"),
	});

	const db = orm(new Surreal(), user, post);

	test("generates basic LIVE SELECT", () => {
		const query = db.live("user");
		const ctx = displayContext();
		const result = query[__display](ctx);

		expect(result).toContain("LIVE SELECT * FROM");
		expect(Object.values(ctx.variables)).toContainEqual(new Table("user"));
	});

	test("generates LIVE SELECT with WHERE", () => {
		const query = db.live("user").where(($this) => $this.age.gt(18));
		const ctx = displayContext();
		const result = query[__display](ctx);

		expect(result).toContain("LIVE SELECT * FROM");
		expect(result).toContain("WHERE");
		expect(result).toContain(">");
	});

	test("generates LIVE SELECT DIFF", () => {
		const query = db.live("user").diff();
		const ctx = displayContext();
		const result = query[__display](ctx);

		expect(result).toContain("LIVE SELECT DIFF FROM");
	});

	test("generates LIVE SELECT with VALUE projection via return", () => {
		const query = db.live("user").return(($this) => ({
			name: $this.name,
			email: $this.email,
		}));
		const ctx = displayContext();
		const result = query[__display](ctx);

		expect(result).toContain("LIVE SELECT VALUE");
		expect(result).toContain("email");
	});

	test("generates LIVE SELECT with FETCH", () => {
		const query = db.live("post").fetch("author");
		const ctx = displayContext();
		const result = query[__display](ctx);

		expect(result).toContain("LIVE SELECT * FROM");
		expect(result).toContain("FETCH author");
	});

	test("combines WHERE and FETCH", () => {
		const query = db
			.live("post")
			.where(($this) => $this.title.contains("hello"))
			.fetch("author");
		const ctx = displayContext();
		const result = query[__display](ctx);

		expect(result).toContain("LIVE SELECT * FROM");
		expect(result).toContain("WHERE");
		expect(result).toContain("FETCH author");
	});

	test("does not emit clauses unsupported by LIVE SELECT", () => {
		const query = db.live("user").where(($this) => $this.age.gte(18));
		const ctx = displayContext();
		const result = query[__display](ctx);

		expect(result).not.toContain("LIMIT");
		expect(result).not.toContain("START");
		expect(result).not.toContain("ORDER BY");
		expect(result).not.toContain("GROUP");
	});

	test("hydrates full record notifications for modeled tables", async () => {
		const baseUser = table("user", {
			given_name: t.string(),
			family_name: t.string(),
		});

		class User extends baseUser.Model {
			get fullName() {
				return `${this.given_name} ${this.family_name}`;
			}
		}

		const user = baseUser.withModel(User);
		const { surreal, emit } = createMockLiveSession();
		const db = orm(surreal, user);
		const sub = await db.live("user").execute();

		let received:
			| {
					action: string;
					recordId: RecordId<string>;
					value: unknown;
			  }
			| undefined;
		sub.subscribe((message) => {
			received = message;
		});

		emit({
			action: "CREATE",
			recordId: new RecordId("user", "ada"),
			value: {
				id: new RecordId("user", "ada"),
				given_name: "Ada",
				family_name: "Lovelace",
			},
		});

		const hydratedUser = received?.value as
			| ({
					id: RecordId<"user">;
					given_name: string;
					family_name: string;
			  } & InstanceType<typeof User>)
			| undefined;

		expect(hydratedUser instanceof User).toBe(true);
		expect(hydratedUser?.fullName).toBe("Ada Lovelace");
	});

	test("does not hydrate DIFF or KILLED notifications", async () => {
		const baseUser = table("user", { name: t.string() });

		class User extends baseUser.Model {}

		const user = baseUser.withModel(User);
		const diffSession = createMockLiveSession();
		const diffDb = orm(diffSession.surreal, user);
		const diffSub = await diffDb.live("user").diff().execute();
		let diffValue: unknown;
		diffSub.subscribe((message) => {
			diffValue = message.value;
		});

		const diffPayload = [{ op: "replace", path: "/name", value: "Ada" }];
		diffSession.emit({
			action: "UPDATE",
			recordId: new RecordId("user", "ada"),
			value: diffPayload,
		});

		const killedSession = createMockLiveSession();
		const killedDb = orm(killedSession.surreal, user);
		const killedSub = await killedDb.live("user").execute();
		let killedValue: unknown;
		killedSub.subscribe((message) => {
			killedValue = message.value;
		});

		const killedPayload = {
			id: new RecordId("user", "ada"),
			name: "Ada",
		};
		killedSession.emit({
			action: "KILLED",
			recordId: new RecordId("user", "ada"),
			value: killedPayload,
		});

		expect(diffValue).toBe(diffPayload);
		expect(killedValue).toBe(killedPayload);
		expect(killedValue instanceof User).toBe(false);
	});
});
