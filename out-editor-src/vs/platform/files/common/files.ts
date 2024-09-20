/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer, VSBufferReadable, VSBufferReadableStream } from '../../../base/common/buffer.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

//#region file service & providers

export const IFileService = createDecorator<IFileService>('fileService');

export interface IFileService {

	readonly _serviceBrand: undefined;

	/**
	 * Updates the content replacing its previous value.
	 *
	 * Emits a `FileOperation.WRITE` file operation event when successful.
	 */
	writeFile(resource: URI, bufferOrReadableOrStream: VSBuffer | VSBufferReadable | VSBufferReadableStream, options?: IWriteFileOptions): Promise<IFileStatWithMetadata>;

	/**
	 * Frees up any resources occupied by this service.
	 */
	dispose(): void;
}

export interface IBaseFileStat {
}

export interface IBaseFileStatWithMetadata extends Required<IBaseFileStat> { }

/**
 * A file resource with meta information and resolved children if any.
 */
export interface IFileStat extends IBaseFileStat {
}

export interface IFileStatWithMetadata extends IFileStat, IBaseFileStatWithMetadata {
}

export interface IWriteFileOptions {
}

//#endregion

//#region Utilities

export enum FileKind {
	FILE,
	FOLDER,
	ROOT_FOLDER
}

//#endregion
