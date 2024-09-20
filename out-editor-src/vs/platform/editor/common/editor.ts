/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';

export interface IResolvableEditorModel extends IDisposable {
}

export interface IBaseUntypedEditorInput {
}

export interface IBaseResourceEditorInput extends IBaseUntypedEditorInput {
}

export interface IBaseTextResourceEditorInput extends IBaseResourceEditorInput {
}

export interface IResourceEditorInput extends IBaseResourceEditorInput {

	/**
	 * The resource URI of the resource to open.
	 */
	readonly resource: URI;
}

export interface ITextResourceEditorInput extends IResourceEditorInput, IBaseTextResourceEditorInput {

	/**
	 * Optional options to use when opening the text input.
	 */
	options?: ITextEditorOptions;
}

export enum EditorOpenSource {

	/**
	 * Default: the editor is opening via a programmatic call
	 * to the editor service API.
	 */
	API,

	/**
	 * Indicates that a user action triggered the opening, e.g.
	 * via mouse or keyboard use.
	 */
	USER
}

export interface IEditorOptions {

	/**
	 * Tells the editor to not receive keyboard focus when the editor is being opened.
	 *
	 * Will also not activate the group the editor opens in unless the group is already
	 * the active one. This behaviour can be overridden via the `activation` option.
	 */
	preserveFocus?: boolean;

	/**
	 * Will reveal the editor if it is already opened and visible in any of the opened editor groups.
	 *
	 * Note that this option is just a hint that might be ignored if the user wants to open an editor explicitly
	 * to the side of another one or into a specific editor group.
	 */
	revealIfVisible?: boolean;

	/**
	 * Will reveal the editor if it is already opened (even when not visible) in any of the opened editor groups.
	 *
	 * Note that this option is just a hint that might be ignored if the user wants to open an editor explicitly
	 * to the side of another one or into a specific editor group.
	 */
	revealIfOpened?: boolean;

	/**
	 * An editor that is pinned remains in the editor stack even when another editor is being opened.
	 * An editor that is not pinned will always get replaced by another editor that is not pinned.
	 */
	pinned?: boolean;

	/**
	 * A optional hint to signal in which context the editor opens.
	 *
	 * If configured to be `EditorOpenSource.USER`, this hint can be
	 * used in various places to control the experience. For example,
	 * if the editor to open fails with an error, a notification could
	 * inform about this in a modal dialog. If the editor opened through
	 * some background task, the notification would show in the background,
	 * not as a modal dialog.
	 */
	source?: EditorOpenSource;
}

export interface ITextEditorSelection {
	readonly startLineNumber: number;
	readonly startColumn: number;
	readonly endLineNumber?: number;
	readonly endColumn?: number;
}

export const enum TextEditorSelectionRevealType {
	/**
	 * Option to scroll vertically or horizontally as necessary and reveal a range centered vertically.
	 */
	Center = 0,

	/**
	 * Option to scroll vertically or horizontally as necessary and reveal a range centered vertically only if it lies outside the viewport.
	 */
	CenterIfOutsideViewport = 1,

	/**
	 * Option to scroll vertically or horizontally as necessary and reveal a range close to the top of the viewport, but not quite at the top.
	 */
	NearTop = 2,

	/**
	 * Option to scroll vertically or horizontally as necessary and reveal a range close to the top of the viewport, but not quite at the top.
	 * Only if it lies outside the viewport
	 */
	NearTopIfOutsideViewport = 3,
}

export const enum TextEditorSelectionSource {

	/**
	 * Programmatic source indicates a selection change that
	 * was not triggered by the user via keyboard or mouse
	 * but through text editor APIs.
	 */
	PROGRAMMATIC = 'api',

	/**
	 * Navigation source indicates a selection change that
	 * was caused via some command or UI component such as
	 * an outline tree.
	 */
	NAVIGATION = 'code.navigation',

	/**
	 * Jump source indicates a selection change that
	 * was caused from within the text editor to another
	 * location in the same or different text editor such
	 * as "Go to definition".
	 */
	JUMP = 'code.jump'
}

export interface ITextEditorOptions extends IEditorOptions {

	/**
	 * Text editor selection.
	 */
	selection?: ITextEditorSelection;

	/**
	 * Option to control the text editor selection reveal type.
	 * Defaults to TextEditorSelectionRevealType.Center
	 */
	selectionRevealType?: TextEditorSelectionRevealType;

	/**
	 * Source of the call that caused the selection.
	 */
	selectionSource?: TextEditorSelectionSource | string;
}
