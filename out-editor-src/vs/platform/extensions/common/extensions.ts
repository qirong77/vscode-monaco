

/**
 * **!Do not construct directly!**
 *
 * **!Only static methods because it gets serialized!**
 *
 * This represents the "canonical" version for an extension identifier. Extension ids
 * have to be case-insensitive (due to the marketplace), but we must ensure case
 * preservation because the extension API is already public at this time.
 *
 * For example, given an extension with the publisher `"Hello"` and the name `"World"`,
 * its canonical extension identifier is `"Hello.World"`. This extension could be
 * referenced in some other extension's dependencies using the string `"hello.world"`.
 *
 * To make matters more complicated, an extension can optionally have an UUID. When two
 * extensions have the same UUID, they are considered equal even if their identifier is different.
 */
export class ExtensionIdentifier {
	public readonly value: string;

	/**
	 * Do not use directly. This is public to avoid mangling and thus
	 * allow compatibility between running from source and a built version.
	 */
	readonly _lower: string;

	constructor(value: string) {
		this.value = value;
		this._lower = value.toLowerCase();
	}

	/**
	 * Gives the value by which to index (for equality).
	 */
	public static toKey(id: ExtensionIdentifier | string): string {
		if (typeof id === 'string') {
			return id.toLowerCase();
		}
		return id._lower;
	}
}

export class ExtensionIdentifierSet {

	private readonly _set = new Set<string>();

	constructor(iterable?: Iterable<ExtensionIdentifier | string>) {
		if (iterable) {
			for (const value of iterable) {
				this.add(value);
			}
		}
	}

	public add(id: ExtensionIdentifier | string): void {
		this._set.add(ExtensionIdentifier.toKey(id));
	}

	public has(id: ExtensionIdentifier | string): boolean {
		return this._set.has(ExtensionIdentifier.toKey(id));
	}
}
