import { orm, t, table } from "surqlize";
import { type RecordId, Surreal } from "surrealdb";

// Strict, invariant type-equality check (not mere assignability), so the
// assertions below fail if an inferred shape drifts in *either* direction —
// a missing or extra field is caught, not just an incompatible one.
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;
type Expect<T extends true> = T;

const user = table("user", {
	name: t.string(),
	age: t.number(),
});

const db = orm(new Surreal(), user);
const query = db
	.select("user")
	.where((f) => f.age.gte(18))
	.return((f) => ({ name: f.name }));

const account = table("account", {
	email: t.string(),
});

const accountDb = orm(new Surreal(), account);
const accountQuery = accountDb.select("account");

const baseUser = table("person", {
	email: t.string(),
	given_name: t.string(),
});

class User extends baseUser.Model {
	get fullName() {
		return this.given_name;
	}

	static findByEmail(email: string) {
		return this.select().where((user) => user.email.eq(email));
	}
}

const modeledUser = baseUser.withModel(User);
const modeledDb = orm(new Surreal(), modeledUser);
const modeledQuery = modeledDb.select("person");
const modeledStaticQuery = User.findByEmail("ada@example.com");

async function checkAwaitedSelect() {
	const users = await db.select("user");
	const first = users[0];
	const name: string | undefined = first?.name;
	return name;
}

async function getUsers() {
	return await db.select("user");
}

async function getModeledUsers() {
	return await modeledDb.select("person");
}

class RenamableUser extends User {
	async rename(name: string) {
		const records = await this.upsert().merge({ given_name: name });
		const first = records[0];
		const fullName: string | undefined = first?.fullName;
		return fullName;
	}
}

void checkAwaitedSelect;
void RenamableUser;

type QueryResult = t.infer<typeof query>;
type UserRecord = (typeof user)["type"];
type PlainAccountRow = t.infer<typeof accountQuery>[number];
type PlainAccountHasUpdate = "update" extends keyof PlainAccountRow ? true : false;
type ModeledUserRow = t.infer<typeof modeledQuery>[number];
type ModeledStaticResult = t.infer<typeof modeledStaticQuery>;
type AwaitedUsers = Awaited<ReturnType<typeof getUsers>>;
type AwaitedModeledUsers = Awaited<ReturnType<typeof getModeledUsers>>;
type RenamableRename = Awaited<
	ReturnType<InstanceType<typeof RenamableUser>["rename"]>
>;

// The packaged declarations must parse *and* infer these exact shapes.
type _AssertQuery = Expect<Equal<QueryResult, { name: string }[]>>;
type _AssertUser = Expect<
	Equal<UserRecord, { id: RecordId<"user">; name: string; age: number }>
>;
type _AssertPlainRow = Expect<
	Equal<PlainAccountRow, { id: RecordId<"account">; email: string }>
>;
type _AssertPlainHasNoUpdate = Expect<Equal<PlainAccountHasUpdate, false>>;
type _AssertModeledRow = Expect<Equal<ModeledUserRow, InstanceType<typeof User>>>;
type _AssertModeledGetter = Expect<Equal<ModeledUserRow["fullName"], string>>;
type _AssertModeledStatic = Expect<
	Equal<ModeledStaticResult, InstanceType<typeof User>[]>
>;
type _AssertAwaitedUsers = Expect<Equal<AwaitedUsers, UserRecord[]>>;
type _AssertAwaitedModeledUsers = Expect<
	Equal<AwaitedModeledUsers, InstanceType<typeof User>[]>
>;
type _AssertInstanceRename = Expect<
	Equal<RenamableRename, string | undefined>
>;

void (
	null as
		| _AssertAwaitedUsers
		| _AssertInstanceRename
		| _AssertModeledGetter
		| _AssertModeledRow
		| _AssertModeledStatic
		| _AssertAwaitedModeledUsers
		| _AssertPlainHasNoUpdate
		| _AssertPlainRow
		| _AssertQuery
		| _AssertUser
		| null
);
