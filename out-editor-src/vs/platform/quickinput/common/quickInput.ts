/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IQuickAccessController } from './quickAccess.js';
import { IMatch } from '../../../base/common/filters.js';
import { IItemAccessor } from '../../../base/common/fuzzyScorer.js';
import { ResolvedKeybinding } from '../../../base/common/keybindings.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import { IMarkdownString } from '../../../base/common/htmlContent.js';

export interface IQuickPickItemHighlights {
	label?: IMatch[];
	description?: IMatch[];
	detail?: IMatch[];
}

export type QuickPickItem = IQuickPickSeparator | IQuickPickItem;

export interface IQuickPickItem {
	type?: 'item';
	label: string;
	ariaLabel?: string;
	description?: string;
	detail?: string;
	tooltip?: string | IMarkdownString;
	/**
	 * Allows to show a keybinding next to the item to indicate
	 * how the item can be triggered outside of the picker using
	 * keyboard shortcut.
	 */
	keybinding?: ResolvedKeybinding;
	iconClasses?: readonly string[];
	iconPath?: { dark: URI; light?: URI };
	iconClass?: string;
	italic?: boolean;
	strikethrough?: boolean;
	highlights?: IQuickPickItemHighlights;
	buttons?: readonly IQuickInputButton[];
	picked?: boolean;
	/**
	 * Used when we're in multi-select mode. Renders a disabled checkbox.
	 */
	disabled?: boolean;
	alwaysShow?: boolean;
}

export interface IQuickPickSeparator {
	type: 'separator';
	id?: string;
	label?: string;
	description?: string;
	ariaLabel?: string;
	buttons?: readonly IQuickInputButton[];
	tooltip?: string | IMarkdownString;
}

export interface IKeyMods {
	readonly ctrlCmd: boolean;
	readonly alt: boolean;
}

export const NO_KEY_MODS: IKeyMods = { ctrlCmd: false, alt: false };

export interface IQuickNavigateConfiguration {
	keybindings: readonly ResolvedKeybinding[];
}

export interface IPickOptions<T extends IQuickPickItem> {

	/**
	 * an optional string to show as the title of the quick input
	 */
	title?: string;

	/**
	 * the value to prefill in the input box
	 */
	value?: string;

	/**
	 * an optional string to show as placeholder in the input box to guide the user what she picks on
	 */
	placeHolder?: string;

	/**
	 * an optional flag to include the description when filtering the picks
	 */
	matchOnDescription?: boolean;

	/**
	 * an optional flag to include the detail when filtering the picks
	 */
	matchOnDetail?: boolean;

	/**
	 * an optional flag to filter the picks based on label. Defaults to true.
	 */
	matchOnLabel?: boolean;

	/**
	 * an optional flag to not close the picker on focus lost
	 */
	ignoreFocusLost?: boolean;

	/**
	 * an optional flag to make this picker multi-select
	 */
	canPickMany?: boolean;

	/**
	 * enables quick navigate in the picker to open an element without typing
	 */
	quickNavigate?: IQuickNavigateConfiguration;

	/**
	 * Hides the input box from the picker UI. This is typically used
	 * in combination with quick-navigation where no search UI should
	 * be presented.
	 */
	hideInput?: boolean;

	/**
	 * a context key to set when this picker is active
	 */
	contextKey?: string;

	/**
	 * an optional property for the item to focus initially.
	 */
	activeItem?: Promise<T> | T;

	onKeyMods?: (keyMods: IKeyMods) => void;
	onDidFocus?: (entry: T) => void;
	onDidTriggerItemButton?: (context: IQuickPickItemButtonContext<T>) => void;
	onDidTriggerSeparatorButton?: (context: IQuickPickSeparatorButtonEvent) => void;
}

export interface IInputOptions {

	/**
	 * an optional string to show as the title of the quick input
	 */
	title?: string;

	/**
	 * the value to prefill in the input box
	 */
	value?: string;

	/**
	 * the selection of value, default to the whole prefilled value
	 */
	valueSelection?: readonly [number, number];

	/**
	 * the text to display underneath the input box
	 */
	prompt?: string;

	/**
	 * an optional string to show as placeholder in the input box to guide the user what to type
	 */
	placeHolder?: string;

	/**
	 * Controls if a password input is shown. Password input hides the typed text.
	 */
	password?: boolean;

	/**
	 * an optional flag to not close the input on focus lost
	 */
	ignoreFocusLost?: boolean;

	/**
	 * an optional function that is used to validate user input.
	 */
	validateInput?: (input: string) => Promise<string | null | undefined | { content: string; severity: Severity }>;
}

export enum QuickInputHideReason {

	/**
	 * Focus moved away from the quick input.
	 */
	Blur = 1,

	/**
	 * An explicit user gesture, e.g. pressing Escape key.
	 */
	Gesture,

	/**
	 * Anything else.
	 */
	Other
}

export interface IQuickInputHideEvent {
	reason: QuickInputHideReason;
}

/**
 * A collection of the different types of QuickInput
 */
export const enum QuickInputType {
	QuickPick = 'quickPick',
	InputBox = 'inputBox',
	QuickWidget = 'quickWidget'
}

/**
 * Represents a quick input control that allows users to make selections or provide input quickly.
 */
export interface IQuickInput extends IDisposable {

	/**
	 * The type of the quick input.
	 */
	readonly type: QuickInputType;

	/**
	 * An event that is fired when the quick input is hidden.
	 */
	readonly onDidHide: Event<IQuickInputHideEvent>;

	/**
	 * The title of the quick input.
	 */
	title: string | undefined;

	/**
	 * The context key associated with the quick input.
	 */
	contextKey: string | undefined;

	/**
	 * Indicates whether the quick input is busy. Renders a progress bar if true.
	 */
	busy: boolean;

	/**
	 * Indicates whether the quick input should be hidden when it loses focus.
	 */
	ignoreFocusOut: boolean;

	/**
	 * Shows the quick input.
	 */
	show(): void;

	/**
	 * Hides the quick input.
	 */
	hide(): void;

	/**
	 * Notifies that the quick input has been hidden.
	 * @param reason The reason why the quick input was hidden.
	 */
	didHide(reason?: QuickInputHideReason): void;

	/**
	 * Notifies that the quick input will be hidden.
	 * @param reason The reason why the quick input will be hidden.
	 */
	willHide(reason?: QuickInputHideReason): void;
}

export interface IQuickPickWillAcceptEvent {

	/**
	 * Allows to disable the default accept handling
	 * of the picker. If `veto` is called, the picker
	 * will not trigger the `onDidAccept` event.
	 */
	veto(): void;
}

export interface IQuickPickDidAcceptEvent {

	/**
	 * Signals if the picker item is to be accepted
	 * in the background while keeping the picker open.
	 */
	inBackground: boolean;
}

/**
 * Represents the activation behavior for items in a quick input. This means which item will be
 * "active" (aka focused).
 */
export enum ItemActivation {
	/**
	 * No item will be active.
	 */
	NONE,
	/**
	 * First item will be active.
	 */
	FIRST,
	/**
	 * Second item will be active.
	 */
	SECOND,
	/**
	 * Last item will be active.
	 */
	LAST
}

/**
 * Represents the focus options for a quick pick.
 */
export enum QuickPickFocus {
	/**
	 * Focus the first item in the list.
	 */
	First = 1,
	/**
	 * Focus the second item in the list.
	 */
	Second,
	/**
	 * Focus the last item in the list.
	 */
	Last,
	/**
	 * Focus the next item in the list.
	 */
	Next,
	/**
	 * Focus the previous item in the list.
	 */
	Previous,
	/**
	 * Focus the next page in the list.
	 */
	NextPage,
	/**
	 * Focus the previous page in the list.
	 */
	PreviousPage,
	/**
	 * Focus the first item under the next separator.
	 */
	NextSeparator,
	/**
	 * Focus the first item under the current separator.
	 */
	PreviousSeparator
}

/**
 * Represents a quick pick control that allows the user to select an item from a list of options.
 */
export interface IQuickPick<T extends IQuickPickItem, O extends { useSeparators: boolean } = { useSeparators: false }> extends IQuickInput {

	/**
	 * The current value of the quick pick input.
	 */
	value: string;

	/**
	 * A method that allows to massage the value used for filtering, e.g, to remove certain parts.
	 * @param value The value to be filtered.
	 * @returns The filtered value.
	 */
	filterValue: (value: string) => string;

	/**
	 * The ARIA label for the quick pick input.
	 */
	ariaLabel: string | undefined;

	/**
	 * The placeholder text for the quick pick input.
	 */
	placeholder: string | undefined;

	/**
	 * An event that is fired when the value of the quick pick input changes.
	 */
	readonly onDidChangeValue: Event<string>;

	/**
	 * An event that is fired when the quick pick is about to accept the selected item.
	 */
	readonly onWillAccept: Event<IQuickPickWillAcceptEvent>;

	/**
	 * An event that is fired when the quick pick has accepted the selected item.
	 */
	readonly onDidAccept: Event<IQuickPickDidAcceptEvent>;

	/**
	 * If enabled, the `onDidAccept` event will be fired when pressing the arrow-right key to accept the selected item without closing the picker.
	 */
	canAcceptInBackground: boolean;

	/**
	 * An event that is fired when an item button is triggered.
	 */
	readonly onDidTriggerItemButton: Event<IQuickPickItemButtonEvent<T>>;

	/**
	 * An event that is fired when a separator button is triggered.
	 */
	readonly onDidTriggerSeparatorButton: Event<IQuickPickSeparatorButtonEvent>;

	/**
	 * The items to be displayed in the quick pick.
	 */
	items: O extends { useSeparators: true } ? ReadonlyArray<T | IQuickPickSeparator> : ReadonlyArray<T>;

	/**
	 * Whether multiple items can be selected. If so, checkboxes will be rendered.
	 */
	canSelectMany: boolean;

	/**
	 * Whether to match on the description of the items.
	 */
	matchOnDescription: boolean;

	/**
	 * Whether to match on the detail of the items.
	 */
	matchOnDetail: boolean;

	/**
	 * Whether to match on the label of the items.
	 */
	matchOnLabel: boolean;

	/**
	 * Whether to sort the items by label.
	 */
	sortByLabel: boolean;

	/**
	 * Whether to keep the scroll position when the quick pick input is updated.
	 */
	keepScrollPosition: boolean;

	/**
	 * The configuration for quick navigation.
	 */
	quickNavigate: IQuickNavigateConfiguration | undefined;

	/**
	 * The currently active items.
	 */
	activeItems: ReadonlyArray<T>;

	/**
	 * An event that is fired when the active items change.
	 */
	readonly onDidChangeActive: Event<T[]>;

	/**
	 * The item activation behavior for the next time `items` is set. Item activation means which
	 * item is "active" (aka focused) when the quick pick is opened or when `items` is set.
	 */
	itemActivation: ItemActivation;

	/**
	 * The currently selected items.
	 */
	selectedItems: ReadonlyArray<T>;

	/**
	 * An event that is fired when the selected items change.
	 */
	readonly onDidChangeSelection: Event<T[]>;

	/**
	 * The key modifiers.
	 */
	readonly keyMods: IKeyMods;

	/**
	 * The selection range for the value in the input.
	 */
	valueSelection: Readonly<[number, number]> | undefined;

	/**
	 * Hides the input box from the picker UI. This is typically used in combination with quick-navigation where no search UI should be presented.
	 */
	hideInput: boolean;

	/**
	 * Focus a particular item in the list. Used internally for keyboard navigation.
	 * @param focus The focus behavior.
	 */
	focus(focus: QuickPickFocus): void;

	/**
	 * Programmatically accepts an item. Used internally for keyboard navigation.
	 * @param inBackground Whether you are accepting an item in the background and keeping the picker open.
	 */
	accept(inBackground?: boolean): void;
}

/**
 * Represents a toggle for quick input.
 */
export interface IQuickInputToggle {
}

/**
 * Represents an input box in a quick input dialog.
 */
export interface IInputBox extends IQuickInput {

	/**
	 * Value shown in the input box.
	 */
	value: string;

	/**
	 * Provide start and end values to be selected in the input box.
	 */
	valueSelection: Readonly<[number, number]> | undefined;

	/**
	 * Value shown as example for input.
	 */
	placeholder: string | undefined;

	/**
	 * Determines if the input value should be hidden while typing.
	 */
	password: boolean;

	/**
	 * Event called when the input value changes.
	 */
	readonly onDidChangeValue: Event<string>;

	/**
	 * Event called when the user submits the input.
	 */
	readonly onDidAccept: Event<void>;

	/**
	 * Text show below the input box.
	 */
	prompt: string | undefined;

	/**
	 * An optional validation message indicating a problem with the current input value.
	 * Returning undefined clears the validation message.
	 */
	validationMessage: string | undefined;

	/**
	 * Severity of the input validation message.
	 */
	severity: Severity;
}

export enum QuickInputButtonLocation {
	/**
	 * In the title bar.
	 */
	Title = 1,

	/**
	 * To the right of the input box.
	 */
	Inline = 2
}

/**
 * Represents a button in the quick input UI.
 */
export interface IQuickInputButton {
	/**
	 * The path to the icon for the button.
	 * Either `iconPath` or `iconClass` is required.
	 */
	iconPath?: { dark: URI; light?: URI };
	/**
	 * The CSS class for the icon of the button.
	 * Either `iconPath` or `iconClass` is required.
	 */
	iconClass?: string;
	/**
	 * The tooltip text for the button.
	 */
	tooltip?: string;
	/**
	 * Whether to always show the button.
	 * By default, buttons are only visible when hovering over them with the mouse.
	 */
	alwaysVisible?: boolean;
	/**
	 * Where the button should be rendered. The default is {@link QuickInputButtonLocation.Title}.
	 * @note This property is ignored if the button was added to a QuickPickItem.
	 */
	location?: QuickInputButtonLocation;
}

/**
 * Represents an event that occurs when a button associated with a quick pick item is clicked.
 * @template T - The type of the quick pick item.
 */
export interface IQuickPickItemButtonEvent<T extends IQuickPickItem> {
	/**
	 * The button that was clicked.
	 */
	button: IQuickInputButton;
	/**
	 * The quick pick item associated with the button.
	 */
	item: T;
}

/**
 * Represents an event that occurs when a separator button is clicked in a quick pick.
 */
export interface IQuickPickSeparatorButtonEvent {
	/**
	 * The button that was clicked.
	 */
	button: IQuickInputButton;
	/**
	 * The separator associated with the button.
	 */
	separator: IQuickPickSeparator;
}

/**
 * Represents a context for a button associated with a quick pick item.
 * @template T - The type of the quick pick item.
 */
export interface IQuickPickItemButtonContext<T extends IQuickPickItem> extends IQuickPickItemButtonEvent<T> {
	/**
	 * Removes the associated item from the quick pick.
	 */
	removeItem(): void;
}

export type QuickPickInput<T = IQuickPickItem> = T | IQuickPickSeparator;


//#region Fuzzy Scorer Support

export type IQuickPickItemWithResource = IQuickPickItem & { resource?: URI };

export class QuickPickItemScorerAccessor implements IItemAccessor<IQuickPickItemWithResource> {

	constructor(private options?: { skipDescription?: boolean; skipPath?: boolean }) { }
}

export const quickPickItemScorerAccessor = new QuickPickItemScorerAccessor();

//#endregion

export const IQuickInputService = createDecorator<IQuickInputService>('quickInputService');

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export interface IQuickInputService {

	readonly _serviceBrand: undefined;

	/**
	 * Provides access to the quick access providers.
	 */
	readonly quickAccess: IQuickAccessController;

	/**
	 * Opens the quick input box for selecting items and returns a promise
	 * with the user selected item(s) if any.
	 */
	pick<T extends IQuickPickItem>(picks: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options?: IPickOptions<T> & { canPickMany: true }, token?: CancellationToken): Promise<T[] | undefined>;
	pick<T extends IQuickPickItem>(picks: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options?: IPickOptions<T> & { canPickMany: false }, token?: CancellationToken): Promise<T | undefined>;
	pick<T extends IQuickPickItem>(picks: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options?: Omit<IPickOptions<T>, 'canPickMany'>, token?: CancellationToken): Promise<T | undefined>;

	/**
	 * Opens the quick input box for text input and returns a promise with the user typed value if any.
	 */
	input(options?: IInputOptions, token?: CancellationToken): Promise<string | undefined>;

	/**
	 * Provides raw access to the quick pick controller.
	 */
	createQuickPick<T extends IQuickPickItem>(options: { useSeparators: true }): IQuickPick<T, { useSeparators: true }>;
	createQuickPick<T extends IQuickPickItem>(options?: { useSeparators: boolean }): IQuickPick<T, { useSeparators: false }>;

	/**
	 * Provides raw access to the input box controller.
	 */
	createInputBox(): IInputBox;

	/**
	 * The current quick pick that is visible. Undefined if none is open.
	 */
	currentQuickInput: IQuickInput | undefined;
}
