/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { URI } from '../../../base/common/uri.js';
import { ILanguageIdCodec } from '../languages.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const ILanguageService = createDecorator<ILanguageService>('languageService');

export interface ILanguageExtensionPoint {
	id: string;
	extensions?: string[];
	filenames?: string[];
	filenamePatterns?: string[];
	firstLine?: string;
	aliases?: string[];
	mimetypes?: string[];
	configuration?: URI;
	/**
	 * @internal
	 */
	icon?: ILanguageIcon;
}

export interface ILanguageSelection {
	readonly languageId: string;
	readonly onDidChange: Event<string>;
}

export interface ILanguageIcon {
}

export interface ILanguageService {
	readonly _serviceBrand: undefined;

	/**
	 * A codec which can encode and decode a string `languageId` as a number.
	 */
	readonly languageIdCodec: ILanguageIdCodec;

	/**
	 * An event emitted when basic language features are requested for the first time.
	 * This event is emitted when embedded languages are encountered (e.g. JS code block inside Markdown)
	 * or when a language is associated to a text model.
	 *
	 * **Note**: Basic language features refers to language configuration related features.
	 * **Note**: This event is a superset of `onDidRequestRichLanguageFeatures`
	 */
	onDidRequestBasicLanguageFeatures: Event<string>;

	/**
	 * An event emitted when rich language features are requested for the first time.
	 * This event is emitted when a language is associated to a text model.
	 *
	 * **Note**: Rich language features refers to tokenizers, language features based on providers, etc.
	 * **Note**: This event is a subset of `onDidRequestRichLanguageFeatures`
	 */
	onDidRequestRichLanguageFeatures: Event<string>;

	/**
	 * Check if `languageId` is registered.
	 */
	isRegisteredLanguageId(languageId: string): boolean;

	/**
	 * Look up a language by its name case insensitive.
	 */
	getLanguageIdByLanguageName(languageName: string): string | null;

	/**
	 * Look up a language by its mime type.
	 */
	getLanguageIdByMimeType(mimeType: string | null | undefined): string | null;

	/**
	 * Guess the language id for a resource.
	 */
	guessLanguageIdByFilepathOrFirstLine(resource: URI, firstLine?: string): string | null;

	/**
	 * Will fall back to 'plaintext' if `languageId` is unknown.
	 */
	createById(languageId: string | null | undefined): ILanguageSelection;

	/**
	 * Will fall back to 'plaintext' if the `languageId` cannot be determined.
	 */
	createByFilepathOrFirstLine(resource: URI | null, firstLine?: string): ILanguageSelection;

	/**
	 * Request basic language features for a language.
	 */
	requestBasicLanguageFeatures(languageId: string): void;

	/**
	 * Request rich language features for a language.
	 */
	requestRichLanguageFeatures(languageId: string): void;

}
