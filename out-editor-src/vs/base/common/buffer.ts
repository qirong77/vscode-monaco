/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Lazy } from './lazy.js';
import * as streams from './stream.js';

declare const Buffer: any;

const hasBuffer = (typeof Buffer !== 'undefined');
const indexOfTable = new Lazy(() => new Uint8Array(256));
let textDecoder: TextDecoder | null;

export class VSBuffer {

	/**
	 * When running in a nodejs context, if `actual` is not a nodejs Buffer, the backing store for
	 * the returned `VSBuffer` instance might use a nodejs Buffer allocated from node's Buffer pool,
	 * which is not transferrable.
	 */
	static wrap(actual: Uint8Array): VSBuffer {
		if (hasBuffer && !(Buffer.isBuffer(actual))) {
			// https://nodejs.org/dist/latest-v10.x/docs/api/buffer.html#buffer_class_method_buffer_from_arraybuffer_byteoffset_length
			// Create a zero-copy Buffer wrapper around the ArrayBuffer pointed to by the Uint8Array
			actual = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
		}
		return new VSBuffer(actual);
	}

	readonly buffer: Uint8Array;
	readonly byteLength: number;

	private constructor(buffer: Uint8Array) {
		this.buffer = buffer;
		this.byteLength = this.buffer.byteLength;
	}

	toString(): string {
		if (hasBuffer) {
			return this.buffer.toString();
		} else {
			if (!textDecoder) {
				textDecoder = new TextDecoder();
			}
			return textDecoder.decode(this.buffer);
		}
	}
}

export function readUInt16LE(source: Uint8Array, offset: number): number {
	return (
		((source[offset + 0] << 0) >>> 0) |
		((source[offset + 1] << 8) >>> 0)
	);
}

export function writeUInt16LE(destination: Uint8Array, value: number, offset: number): void {
	destination[offset + 0] = (value & 0b11111111);
	value = value >>> 8;
	destination[offset + 1] = (value & 0b11111111);
}

export function readUInt32BE(source: Uint8Array, offset: number): number {
	return (
		source[offset] * 2 ** 24
		+ source[offset + 1] * 2 ** 16
		+ source[offset + 2] * 2 ** 8
		+ source[offset + 3]
	);
}

export function writeUInt32BE(destination: Uint8Array, value: number, offset: number): void {
	destination[offset + 3] = value;
	value = value >>> 8;
	destination[offset + 2] = value;
	value = value >>> 8;
	destination[offset + 1] = value;
	value = value >>> 8;
	destination[offset] = value;
}

export function readUInt8(source: Uint8Array, offset: number): number {
	return source[offset];
}

export function writeUInt8(destination: Uint8Array, value: number, offset: number): void {
	destination[offset] = value;
}

export interface VSBufferReadable extends streams.Readable<VSBuffer> { }

export interface VSBufferReadableStream extends streams.ReadableStream<VSBuffer> { }
