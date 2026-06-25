import { describe, expect, test } from "bun:test";
import { RecordId, Surreal } from "surrealdb";
import { orm, Transaction, t, table } from "../../../src";

describe("Transaction", () => {
	test("Transaction has query builder methods from Orm", () => {
		expect(Transaction.prototype).toHaveProperty("select");
		expect(Transaction.prototype).toHaveProperty("create");
		expect(Transaction.prototype).toHaveProperty("insert");
		expect(Transaction.prototype).toHaveProperty("update");
		expect(Transaction.prototype).toHaveProperty("upsert");
		expect(Transaction.prototype).toHaveProperty("delete");
		expect(Transaction.prototype).toHaveProperty("relate");
		expect(Transaction.prototype).toHaveProperty("attach");
	});

	test("Transaction has commit and cancel methods", () => {
		expect(Transaction.prototype).toHaveProperty("commit");
		expect(Transaction.prototype).toHaveProperty("cancel");
		expect(typeof Transaction.prototype.commit).toBe("function");
		expect(typeof Transaction.prototype.cancel).toBe("function");
	});

	test("Orm has transaction method", () => {
		const user = table("user", { name: t.string() });
		const db = orm(new Surreal(), user);

		expect(db).toHaveProperty("transaction");
		expect(typeof db.transaction).toBe("function");
	});

	test("Transaction inherits attach() with model-aware typing", () => {
		const baseUser = table("user", { name: t.string() });

		class User extends baseUser.Model {
			verifyEmail() {
				return this.name.length > 0;
			}
		}

		const user = baseUser.withModel(User);
		const attachedUser = {
			id: new RecordId("user", "ada"),
			name: "Ada",
			verifyEmail: () => true,
		} as { id: RecordId<"user">; name: string } & InstanceType<typeof User>;
		const attachInTx = (tx: Transaction<[typeof user]>) => {
			const rebound = tx.attach(attachedUser);
			rebound.verifyEmail();
			return rebound;
		};

		expect(typeof attachInTx).toBe("function");
	});
});
