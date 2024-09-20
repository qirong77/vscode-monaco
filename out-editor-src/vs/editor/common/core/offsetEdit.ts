/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BugIndicatingError } from '../../../base/common/errors.js';
import { OffsetRange } from './offsetRange.js';

/**
 * Describes an edit to a (0-based) string.
 * Use `TextEdit` to describe edits for a 1-based line/column text.
*/
export class OffsetEdit {
	public static readonly empty = new OffsetEdit([]);

	public static replace(
		range: OffsetRange,
		newText: string,
	): OffsetEdit {
		return new OffsetEdit([new SingleOffsetEdit(range, newText)]);
	}

	constructor(
		public readonly edits: readonly SingleOffsetEdit[],
	) {
		let lastEndEx = -1;
		for (const edit of edits) {
			if (!(edit.replaceRange.start >= lastEndEx)) {
				throw new BugIndicatingError(`Edits must be disjoint and sorted. Found ${edit} after ${lastEndEx}`);
			}
			lastEndEx = edit.replaceRange.endExclusive;
		}
	}

	toString() {
		const edits = this.edits.map(e => e.toString()).join(', ');
		return `[${edits}]`;
	}

	apply(str: string): string {
		const resultText: string[] = [];
		let pos = 0;
		for (const edit of this.edits) {
			resultText.push(str.substring(pos, edit.replaceRange.start));
			resultText.push(edit.newText);
			pos = edit.replaceRange.endExclusive;
		}
		resultText.push(str.substring(pos));
		return resultText.join('');
	}

	getNewTextRanges(): OffsetRange[] {
		const ranges: OffsetRange[] = [];
		let offset = 0;
		for (const e of this.edits) {
			ranges.push(OffsetRange.ofStartAndLength(e.replaceRange.start + offset, e.newText.length),);
			offset += e.newText.length - e.replaceRange.length;
		}
		return ranges;
	}
}

export class SingleOffsetEdit {

	public static insert(offset: number, text: string): SingleOffsetEdit {
		return new SingleOffsetEdit(OffsetRange.emptyAt(offset), text);
	}

	constructor(
		public readonly replaceRange: OffsetRange,
		public readonly newText: string,
	) { }

	toString(): string {
		return `${this.replaceRange} -> "${this.newText}"`;
	}
}
