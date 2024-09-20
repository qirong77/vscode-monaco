
import { ContiguousMultilineTokens } from './contiguousMultilineTokens.js';

export class ContiguousMultilineTokensBuilder {

	private readonly _tokens: ContiguousMultilineTokens[];

	constructor() {
		this._tokens = [];
	}

	public add(lineNumber: number, lineTokens: Uint32Array): void {
		if (this._tokens.length > 0) {
			const last = this._tokens[this._tokens.length - 1];
			if (last.endLineNumber + 1 === lineNumber) {
				// append
				last.appendLineTokens(lineTokens);
				return;
			}
		}
		this._tokens.push(new ContiguousMultilineTokens(lineNumber, [lineTokens]));
	}

	public finalize(): ContiguousMultilineTokens[] {
		return this._tokens;
	}
}
