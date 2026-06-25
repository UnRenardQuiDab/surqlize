import { RecordId, type RecordIdValue } from "surrealdb";
import type { CreateQuery } from "../query/create";
import type { DeleteQuery } from "../query/delete";
import type { SelectQuery } from "../query/select";
import type { UpdateQuery } from "../query/update";
import type { UpsertQuery } from "../query/upsert";
import type {
	AbstractType,
	ArrayType,
	ObjectType,
	OptionType,
	RecordType,
} from "../types";
import type { WorkableContext } from "../utils";
import type { Orm } from "./orm";
import { TableSchema, type TableFields } from "./table";

export const recordOrmSymbol = Symbol("surqlize.record.orm");
export const recordTableSymbol = Symbol("surqlize.record.table");

type TableRecordId<Tb extends string> = RecordType<Tb>;

export type TableRecord<
	Tb extends string,
	Fd extends TableFields,
> = ObjectType<Fd & { id: TableRecordId<Tb> }>["infer"];

type ModelTableSchema<Tb extends string, Fd extends TableFields> = TableSchema<
	Tb,
	Fd,
	TableModelConstructor<Tb, Fd> | undefined
>;

type ModelOrmFor<Tb extends string, Fd extends TableFields> = Orm & {
	tables: Record<Tb, ModelTableSchema<Tb, Fd>>;
};

type ModelContext<Tb extends string, Fd extends TableFields> = WorkableContext<
	ModelOrmFor<Tb, Fd>
>;

export type ModelStaticHelpers<
	Tb extends string,
	Fd extends TableFields,
> = {
	select<This extends TableModelConstructor<Tb, Fd>>(
		this: This,
	): SelectQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		InstanceType<This>
	>;
	create<This extends TableModelConstructor<Tb, Fd>>(
		this: This,
		id?: RecordIdValue,
	): CreateQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		InstanceType<This>
	>;
	update<This extends TableModelConstructor<Tb, Fd>>(
		this: This,
	): UpdateQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		InstanceType<This>
	>;
	upsert<This extends TableModelConstructor<Tb, Fd>>(
		this: This,
	): UpsertQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		InstanceType<This>
	>;
	delete<This extends TableModelConstructor<Tb, Fd>>(
		this: This,
	): DeleteQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		InstanceType<This>
	>;
};

type ModelTable = TableSchema<string, any, any> & {
	readonly model: TableModelConstructor<string, TableFields>;
};

type ModelOrm = {
	readonly tables: Record<string, unknown>;
	readonly hasModels?: boolean;
	select(subject: RecordId<string>): unknown;
	update(subject: RecordId<string>): unknown;
	upsert(subject: RecordId<string>): unknown;
	delete(subject: RecordId<string>): unknown;
};

export type TableModelInstance<
	Tb extends string,
	Fd extends TableFields,
> = TableRecord<Tb, Fd> & RecordInstanceHelpers<Tb, Fd>;

export interface RecordInstanceHelpers<
	Tb extends string = string,
	Fd extends TableFields = TableFields,
> {
	select<This extends TableModelInstance<Tb, Fd>>(
		this: This,
	): SelectQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		This
	>;
	// Keep instance-side `update()` broad so user-defined `update()` methods can
	// override it without conflicting with the base model type.
	update(): unknown;
	upsert<This extends TableModelInstance<Tb, Fd>>(
		this: This,
	): UpsertQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		This
	>;
	delete<This extends TableModelInstance<Tb, Fd>>(
		this: This,
	): DeleteQuery<
		ModelOrmFor<Tb, Fd>,
		ModelContext<Tb, Fd>,
		Tb,
		ModelTableSchema<Tb, Fd>["schema"],
		This
	>;
}

export type TableModelBase<
	Tb extends string,
	Fd extends TableFields,
> = (abstract new (...args: never[]) => TableModelInstance<Tb, Fd>) &
	ModelStaticHelpers<Tb, Fd>;

export type TableModelConstructor<
	Tb extends string,
	Fd extends TableFields,
> = (abstract new (...args: never[]) => TableModelInstance<Tb, Fd>) &
	ModelStaticHelpers<Tb, Fd>;

export type TableResult<
	Tb extends string,
	Fd extends TableFields,
	Model extends TableModelConstructor<Tb, Fd> | undefined,
> = Model extends TableModelConstructor<Tb, Fd>
	? InstanceType<Model>
	: TableRecord<Tb, Fd>;

export type SchemaResult<S> = S extends TableSchema<
	infer Tb extends string,
	infer Fd extends TableFields,
	any
> & {
	readonly model: infer Model;
}
	? Model extends TableModelConstructor<Tb, Fd>
		? InstanceType<Model>
		: TableRecord<Tb, Fd>
	: S extends { type: infer Row }
		? Row
		: never;

type IsExact<A, B> = [A] extends [B]
	? [B] extends [A]
		? true
		: false
	: false;

type HydratedTableResult<
	O extends Orm,
	E extends AbstractType,
> = {
	[K in keyof O["tables"] & string]: O["tables"][K] extends TableSchema<
		infer Tb extends string,
		infer Fd extends TableFields,
		infer Model
	>
		? IsExact<E["infer"], TableRecord<Tb, Fd>> extends true
			? TableResult<
					Tb,
					Fd,
					Model extends TableModelConstructor<Tb, Fd> ? Model : undefined
			  >
			: never
		: never;
}[keyof O["tables"] & string];

type HydratedArrayValue<
	O extends Orm,
	T extends AbstractType[] | AbstractType,
> = T extends AbstractType[]
	? {
			[K in keyof T]: T[K] extends AbstractType
				? HydratedQueryValue<O, T[K]>
				: never;
		}
	: T extends AbstractType
		? HydratedQueryValue<O, T>[]
		: never;

export type HydratedQueryValue<
	O extends Orm,
	E extends AbstractType,
> = [HydratedTableResult<O, E>] extends [never]
	? E extends OptionType<infer Inner extends AbstractType>
		? HydratedQueryValue<O, Inner> | undefined
		: E extends ArrayType<infer Inner extends AbstractType[] | AbstractType>
			? HydratedArrayValue<O, Inner>
			: E extends ObjectType<infer Fields>
				? {
						[K in keyof Fields]: Fields[K] extends AbstractType
							? HydratedQueryValue<O, Fields[K]>
							: never;
					} & {}
				: E["infer"]
	: HydratedTableResult<O, E>;

export type HydratedRecord<T extends object = object> = T &
	RecordInstanceHelpers & {
		readonly [recordOrmSymbol]: ModelOrm;
		readonly [recordTableSymbol]: ModelTable;
	};

const modeledOrmCache = new WeakMap<object, boolean>();

function hasModels(orm: ModelOrm): boolean {
	if (typeof orm.hasModels === "boolean") {
		return orm.hasModels;
	}

	const cached = modeledOrmCache.get(orm);
	if (cached !== undefined) {
		return cached;
	}

	const value = Object.values(orm.tables).some(
		(table): table is ModelTable =>
			table instanceof TableSchema &&
			typeof table.model === "function",
	);
	modeledOrmCache.set(orm, value);
	return value;
}

function isHydratableObject(
	value: unknown,
): value is Record<PropertyKey, unknown> & { id?: unknown } {
	return (
		typeof value === "object" &&
		value !== null &&
		!(value instanceof Date) &&
		!(value instanceof RecordId)
	);
}

function defineRecordHelper(
	record: object,
	name: keyof RecordInstanceHelpers,
	fn: (this: HydratedRecord) => unknown,
) {
	if (name in record) {
		return;
	}

	Object.defineProperty(record, name, {
		value: fn,
		enumerable: false,
		configurable: true,
		writable: true,
	});
}

function getRecordOrm(record: HydratedRecord): ModelOrm {
	return record[recordOrmSymbol];
}

function getRecordId(record: object): RecordId<string> {
	return (record as { id: RecordId<string> }).id;
}

function resolveModelTable(
	orm: ModelOrm,
	value: Record<PropertyKey, unknown> & { id?: unknown },
): ModelTable | undefined {
	const hydratedTable = value[recordTableSymbol];
	if (
		hydratedTable instanceof TableSchema &&
		typeof hydratedTable.model === "function"
	) {
		return hydratedTable as ModelTable;
	}

	if (!(value.id instanceof RecordId)) {
		return undefined;
	}

	const table = orm.tables[String(value.id.table)];
	if (
		table instanceof TableSchema &&
		typeof table.model === "function"
	) {
		return table as ModelTable;
	}

	return undefined;
}

export function hydrateRecord<T extends object>(
	orm: ModelOrm,
	record: T,
	table: ModelTable,
): HydratedRecord<T> {
	const hydrated = record as HydratedRecord<T>;

	Object.setPrototypeOf(hydrated, table.model.prototype);
	Object.defineProperty(hydrated, recordOrmSymbol, {
		value: orm,
		enumerable: false,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(hydrated, recordTableSymbol, {
		value: table,
		enumerable: false,
		configurable: true,
		writable: true,
	});

	defineRecordHelper(hydrated, "select", function select(this: HydratedRecord) {
		return getRecordOrm(this).select(getRecordId(this));
	});
	defineRecordHelper(hydrated, "update", function update(this: HydratedRecord) {
		return getRecordOrm(this).update(getRecordId(this));
	});
	defineRecordHelper(hydrated, "upsert", function upsert(this: HydratedRecord) {
		return getRecordOrm(this).upsert(getRecordId(this));
	});
	defineRecordHelper(hydrated, "delete", function del(this: HydratedRecord) {
		return getRecordOrm(this).delete(getRecordId(this));
	});

	return hydrated;
}

function hydrateValueInternal(
	orm: ModelOrm,
	value: unknown,
	seen: WeakSet<object>,
): unknown {
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i += 1) {
			value[i] = hydrateValueInternal(orm, value[i], seen);
		}
		return value;
	}

	if (!isHydratableObject(value)) {
		return value;
	}

	if (seen.has(value)) {
		return value;
	}
	seen.add(value);

	for (const key of Object.keys(value)) {
		value[key] = hydrateValueInternal(orm, value[key], seen);
	}

	const table = resolveModelTable(orm, value);
	if (!table) {
		return value;
	}

	return hydrateRecord(orm, value, table);
}

export function hydrateValue<T>(orm: ModelOrm, value: T): T {
	if (!hasModels(orm)) {
		return value;
	}

	return hydrateValueInternal(orm, value, new WeakSet()) as T;
}

function cloneValueInternal<T>(
	value: T,
	clones: WeakMap<object, unknown>,
): T {
	if (Array.isArray(value)) {
		if (clones.has(value)) {
			return clones.get(value) as T;
		}

		const cloned: unknown[] = new Array(value.length);
		clones.set(value, cloned);

		for (let i = 0; i < value.length; i += 1) {
			cloned[i] = cloneValueInternal(value[i], clones);
		}

		return cloned as T;
	}

	if (!isHydratableObject(value)) {
		return value;
	}

	if (clones.has(value)) {
		return clones.get(value) as T;
	}

	const cloned = Object.create(
		Object.getPrototypeOf(value),
		Object.getOwnPropertyDescriptors(value),
	) as Record<PropertyKey, unknown>;
	clones.set(value, cloned);

	for (const key of Object.keys(cloned)) {
		cloned[key] = cloneValueInternal(cloned[key], clones);
	}

	return cloned as T;
}

export function attachToOrm<T>(orm: ModelOrm, value: T): T {
	if (!hasModels(orm)) {
		return value;
	}

	return hydrateValue(orm, cloneValueInternal(value, new WeakMap()));
}
