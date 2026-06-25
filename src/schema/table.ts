import {
	type AbstractType,
	type ObjectType,
	type RecordType,
	t,
} from "../types";
import type {
	TableModelBase,
	TableModelConstructor,
	TableRecord,
} from "./model";

/** A record mapping field names (excluding `id`) to their type definitions. */
export type TableFields = Record<Exclude<string, "id">, AbstractType>;

type GetSchemaType<Tb extends string, Fd extends TableFields> = ObjectType<
	Fd & { id: RecordType<Tb> }
>;

/**
 * Schema definition for a SurrealDB table. Automatically includes a typed `id`
 * field based on the table name. Use the {@link table} factory function to
 * create instances.
 *
 * @typeParam Tb - The table name literal type.
 * @typeParam Fd - The user-defined fields for the table.
 */
export class TableSchema<
	Tb extends string = string,
	Fd extends TableFields = TableFields,
	Model extends TableModelConstructor<Tb, Fd> | undefined = undefined,
> {
	private _baseModel?: TableModelBase<Tb, Fd>;

	constructor(
		public readonly tb: Tb,
		public readonly _fields: Fd,
		public readonly model?: Model,
	) {}

	get fields(): Fd & { id: RecordType<Tb> } & {} {
		return {
			...this._fields,
			id: t.record(this.tb as string),
		} as Fd & { id: RecordType<Tb> } & {};
	}

	type = undefined as unknown as TableRecord<Tb, Fd>;

	get schema(): GetSchemaType<Tb, Fd> {
		return t.object(this.fields);
	}

	get Model(): TableModelBase<Tb, Fd> {
		this._baseModel ??= class BaseModel {} as unknown as TableModelBase<Tb, Fd>;
		return this._baseModel;
	}

	withModel<NextModel extends TableModelConstructor<Tb, Fd>>(
		model: NextModel,
	): TableSchema<Tb, Fd, NextModel> & { readonly model: NextModel } {
		return new TableSchema(this.tb, this._fields, model) as TableSchema<
			Tb,
			Fd,
			NextModel
		> & {
			readonly model: NextModel;
		};
	}

	/** Type-guard that checks whether a value matches this table's schema. */
	validate(value: unknown): value is TableRecord<Tb, Fd> {
		return this.schema.validate(value);
	}
}

/**
 * Define a SurrealDB table schema. An `id` field of type `RecordType<Tb>` is
 * automatically added.
 *
 * @param tb - The table name.
 * @param fields - A record of field names to type definitions.
 * @returns A {@link TableSchema} instance.
 *
 * @example
 * ```ts
 * const user = table("user", {
 *   name: t.string(),
 *   age: t.number(),
 *   email: t.string(),
 * });
 * ```
 */
export function table<
	Tb extends string,
	Fd extends Record<Exclude<string, "id">, AbstractType>,
>(
	tb: Tb,
	fields: Fd,
): TableSchema<Tb, Fd>;
export function table<
	Tb extends string,
	Fd extends Record<Exclude<string, "id">, AbstractType>,
	Model extends TableModelConstructor<Tb, Fd>,
>(
	tb: Tb,
	fields: Fd,
	model: Model,
): TableSchema<Tb, Fd, Model> & { readonly model: Model };
export function table<
	Tb extends string,
	Fd extends Record<Exclude<string, "id">, AbstractType>,
	Model extends TableModelConstructor<Tb, Fd>,
>(tb: Tb, fields: Fd, model?: Model) {
	return new TableSchema(tb, fields, model) as unknown as TableSchema<
		Tb,
		Fd,
		Model
	>;
}
