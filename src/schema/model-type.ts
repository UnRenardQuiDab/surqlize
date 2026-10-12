import { OrmError } from "../error";
import { type AbstractType, ObjectType } from "../types";
import {
	assertNoModelHelperFields,
	MODEL_SCHEMA,
	type ModelSchemaMetadata,
	usesModelBase,
} from "./model";
import type { ModelClass } from "../utils/model";

/**
 * The object type of a table linked to a class: rows parse into instances of
 * the class, and the inferred type is the row fields plus the class instance.
 */
// Internal: reachable by type through `TableSchema.schema`, but not part of the
// package's named exports.
export class ModelType<
	Fd extends Record<string, AbstractType> = Record<string, AbstractType>,
	I = unknown,
> extends ObjectType<Fd> {
	declare infer: ObjectType<Fd>["infer"] & I;
	declare accept: ObjectType<Fd>["accept"] &
		Omit<I, keyof ObjectType<Fd>["infer"]>;
	readonly [MODEL_SCHEMA]: ModelSchemaMetadata;

	constructor(
		fields: Fd,
		readonly model: ModelClass,
		readonly tb: string,
		readonly usesModelBase: boolean,
	) {
		super(fields);
		this[MODEL_SCHEMA] = { tb, model, usesModelBase };
	}

	/** Parse a row, then hydrate it into an instance of the linked class. */
	parse(value: unknown): this["infer"] {
		const row = super.parse(value);
		if (this.usesModelBase) {
			assertNoModelHelperFields(row as Record<string, unknown>, this.tb);
		}

		const hydrate = (
			this.model as ModelClass & {
				hydrate?: (value: unknown) => unknown;
			}
		).hydrate;
		if (typeof hydrate === "function") {
			const instance = Reflect.apply(hydrate, this.model, [row]);
			if (
				typeof instance !== "object" ||
				instance === null ||
				!(instance instanceof this.model)
			) {
				throw new OrmError(
					`The hydrate() method for table "${this.tb}" must return an instance of its attached model class`,
				);
			}
			if (this.usesModelBase) {
				assertNoModelHelperFields(
					instance as Record<string, unknown>,
					this.tb,
				);
			}
			return instance as this["infer"];
		}
		return Object.assign(Object.create(this.model.prototype), row);
	}
}
