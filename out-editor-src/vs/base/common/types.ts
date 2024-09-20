/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * @returns whether the provided parameter is a JavaScript String or not.
 */
export function isString(str: unknown): str is string {
	return (typeof str === 'string');
}

/**
 * @returns whether the provided parameter is of type `object` but **not**
 *	`null`, an `array`, a `regexp`, nor a `date`.
 */
export function isObject(obj: unknown): obj is Object {
	// The method can't do a type cast since there are type (like strings) which
	// are subclasses of any put not positvely matched by the function. Hence type
	// narrowing results in wrong results.
	return typeof obj === 'object'
		&& obj !== null
		&& !Array.isArray(obj)
		&& !(obj instanceof RegExp)
		&& !(obj instanceof Date);
}

/**
 * @returns whether the provided parameter is of type `Buffer` or Uint8Array dervived type
 */
export function isTypedArray(obj: unknown): obj is Object {
	const TypedArray = Object.getPrototypeOf(Uint8Array);
	return typeof obj === 'object'
		&& obj instanceof TypedArray;
}

/**
 * In **contrast** to just checking `typeof` this will return `false` for `NaN`.
 * @returns whether the provided parameter is a JavaScript Number or not.
 */
export function isNumber(obj: unknown): obj is number {
	return (typeof obj === 'number' && !isNaN(obj));
}

/**
 * @returns whether the provided parameter is an Iterable, casting to the given generic
 */
export function isIterable<T>(obj: unknown): obj is Iterable<T> {
	return !!obj && typeof (obj as any)[Symbol.iterator] === 'function';
}

/**
 * @returns whether the provided parameter is a JavaScript Boolean or not.
 */
export function isBoolean(obj: unknown): obj is boolean {
	return (obj === true || obj === false);
}

/**
 * @returns whether the provided parameter is undefined.
 */
export function isUndefined(obj: unknown): obj is undefined {
	return (typeof obj === 'undefined');
}

/**
 * @returns whether the provided parameter is defined.
 */
export function isDefined<T>(arg: T | null | undefined): arg is T {
	return !isUndefinedOrNull(arg);
}

/**
 * @returns whether the provided parameter is undefined or null.
 */
export function isUndefinedOrNull(obj: unknown): obj is undefined | null {
	return (isUndefined(obj) || obj === null);
}


export function assertType(condition: unknown, type?: string): asserts condition {
	if (!condition) {
		throw new Error(type ? `Unexpected type, expected '${type}'` : 'Unexpected type');
	}
}

/**
 * Asserts that the argument passed in is neither undefined nor null.
 */
export function assertIsDefined<T>(arg: T | null | undefined): T {
	if (isUndefinedOrNull(arg)) {
		throw new Error('Assertion Failed: argument is undefined or null');
	}

	return arg;
}

/**
 * @returns whether the provided parameter is a JavaScript Function or not.
 */
export function isFunction(obj: unknown): obj is Function {
	return (typeof obj === 'function');
}

export type TypeConstraint = string | Function;

export function validateConstraints(args: unknown[], constraints: Array<TypeConstraint | undefined>): void {
	const len = Math.min(args.length, constraints.length);
	for (let i = 0; i < len; i++) {
		validateConstraint(args[i], constraints[i]);
	}
}

export function validateConstraint(arg: unknown, constraint: TypeConstraint | undefined): void {

	if (isString(constraint)) {
		if (typeof arg !== constraint) {
			throw new Error(`argument does not match constraint: typeof ${constraint}`);
		}
	} else if (isFunction(constraint)) {
		try {
			if (arg instanceof constraint) {
				return;
			}
		} catch {
			// ignore
		}
		if (!isUndefinedOrNull(arg) && (arg as any).constructor === constraint) {
			return;
		}
		if (constraint.length === 1 && constraint.call(undefined, arg) === true) {
			return;
		}
		throw new Error(`argument does not match one of these constraints: arg instanceof constraint, arg.constructor === constraint, nor constraint(arg) === true`);
	}
}

/**
 * Only picks the non-optional properties of a type.
 */
export type OmitOptional<T> = { [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K] };

/**
 * A type that removed readonly-less from all properties of `T`
 */
export type Mutable<T> = {
	-readonly [P in keyof T]: T[P]
};

/**
 * Represents a type that is a partial version of a given type `T`, except a subset.
 */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;
