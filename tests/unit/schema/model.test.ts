import { describe, expect, test } from "bun:test";
import { RecordId, Surreal } from "surrealdb";
import { __ctx, orm, t, table } from "../../../src";
import {
	attachToOrm,
	type HydratedRecord,
	hydrateValue,
} from "../../../src/schema/model";

describe("model runtime", () => {
	test("hydrateValue is a strict no-op when the orm has no models", () => {
		const user = table("user", { name: t.string() });
		const db = orm(new Surreal(), user);

		let touched = 0;
		const value = {
			id: new RecordId("user", "ada"),
			get profile() {
				touched += 1;
				return { city: "London" };
			},
		};

		const result = hydrateValue(db, value);

		expect(result).toBe(value);
		expect(touched).toBe(0);
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
	});

	test("hydrates modeled records and keeps instance helpers non-enumerable", () => {
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
		const post = table("post", { title: t.string() });
		const db = orm(new Surreal(), user, post);
		const record = {
			id: new RecordId("user", "ada"),
			given_name: "Ada",
			family_name: "Lovelace",
		};
		type UserRecord = typeof record;
		type HydratedUser = HydratedRecord<UserRecord> & InstanceType<typeof User>;

		const hydrated = hydrateValue(db, record) as HydratedUser;
		const updateQuery = hydrated.update() as { [__ctx]: { orm: unknown } };

		expect(hydrated).toBe(record);
		expect(hydrated instanceof User).toBe(true);
		expect(hydrated.fullName).toBe("Ada Lovelace");
		expect(updateQuery[__ctx].orm).toBe(db);
		expect(Object.keys(hydrated)).toEqual(["id", "given_name", "family_name"]);
		expect(Object.getOwnPropertyDescriptor(hydrated, "select")?.enumerable).toBe(
			false,
		);
		expect(Object.getOwnPropertyDescriptor(hydrated, "update")?.enumerable).toBe(
			false,
		);
		expect(Object.getOwnPropertyDescriptor(hydrated, "upsert")?.enumerable).toBe(
			false,
		);
		expect(Object.getOwnPropertyDescriptor(hydrated, "delete")?.enumerable).toBe(
			false,
		);
	});

	test("leaves unmodeled table records as plain objects", () => {
		const baseUser = table("user", { name: t.string() });

		class User extends baseUser.Model {}

		const user = baseUser.withModel(User);
		const post = table("post", { title: t.string() });
		const db = orm(new Surreal(), user, post);
		const record = {
			id: new RecordId("post", "hello"),
			title: "Hello",
		};

		const hydrated = hydrateValue(db, record);

		expect(hydrated).toBe(record);
		expect(Object.getPrototypeOf(hydrated)).toBe(Object.prototype);
		expect("update" in hydrated).toBe(false);
	});

	test("does not overwrite user-defined instance methods", () => {
		const baseUser = table("user", {
			name: t.string(),
		});

		class User extends baseUser.Model {
			update() {
				return "custom update";
			}
		}

		const user = baseUser.withModel(User);
		const db = orm(new Surreal(), user);
		const record = {
			id: new RecordId("user", "ada"),
			name: "Ada",
		};
		type HydratedUser = typeof record & InstanceType<typeof User>;

		const hydrated = hydrateValue(db, record) as HydratedUser;

		expect(hydrated instanceof User).toBe(true);
		expect(hydrated.update()).toBe("custom update");
		expect(Object.getOwnPropertyDescriptor(hydrated, "update")).toBeUndefined();
	});

	test("attachToOrm clones and rebinds hydrated model instances", () => {
		const baseUser = table("user", {
			name: t.string(),
		});

		class User extends baseUser.Model {}

		const user = baseUser.withModel(User);
		const db = orm(new Surreal(), user);
		const tx = orm(new Surreal(), user);
		const hydrated = hydrateValue(db, {
			id: new RecordId("user", "ada"),
			name: "Ada",
		}) as HydratedRecord<{ id: RecordId<"user">; name: string }> &
			InstanceType<typeof User>;

		const attached = attachToOrm(tx, hydrated) as typeof hydrated;
		const originalQuery = hydrated.update() as { [__ctx]: { orm: unknown } };
		const attachedQuery = attached.update() as { [__ctx]: { orm: unknown } };

		expect(attached).not.toBe(hydrated);
		expect(attached instanceof User).toBe(true);
		expect(originalQuery[__ctx].orm).toBe(db);
		expect(attachedQuery[__ctx].orm).toBe(tx);
	});

	test("leaves nested objects without ids plain", () => {
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
		const db = orm(new Surreal(), user);
		const projected = {
			author: {
				given_name: "Ada",
				family_name: "Lovelace",
			},
		};

		const hydrated = hydrateValue(db, projected) as typeof projected;

		expect(Object.getPrototypeOf(hydrated.author)).toBe(Object.prototype);
		expect(hydrated.author instanceof User).toBe(false);
	});
});
