
import Severity from '../../../base/common/severity.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export interface IBaseDialogOptions {
	readonly type?: Severity | DialogType;

	readonly title?: string;
	readonly message: string;
	readonly detail?: string;
}

export interface IConfirmation extends IBaseDialogOptions {

	/**
	 * If not provided, defaults to `Yes`.
	 */
	readonly primaryButton?: string;

	/**
	 * If not provided, defaults to `Cancel`.
	 */
	readonly cancelButton?: string;
}

export interface IConfirmationResult extends ICheckboxResult {

	/**
	 * Will be true if the dialog was confirmed with the primary button pressed.
	 */
	readonly confirmed: boolean;
}

export interface IPromptBaseButton<T> {

	/**
	 * @returns the result of the prompt button will be returned
	 * as result from the `prompt()` call.
	 */
	run(checkbox: ICheckboxResult): T | Promise<T>;
}

export interface IPromptButton<T> extends IPromptBaseButton<T> {
	readonly label: string;
}

export interface IPromptCancelButton<T> extends IPromptBaseButton<T> {
}

export interface IPrompt<T> extends IBaseDialogOptions {

	/**
	 * The buttons to show in the prompt. Defaults to `OK`
	 * if no buttons or cancel button is provided.
	 */
	readonly buttons?: IPromptButton<T>[];

	/**
	 * The cancel button to show in the prompt. Defaults to
	 * `Cancel` if set to `true`.
	 */
	readonly cancelButton?: IPromptCancelButton<T> | true | string;
}

export interface IPromptWithCustomCancel<T> extends IPrompt<T> {
	readonly cancelButton: IPromptCancelButton<T>;
}

export interface IPromptWithDefaultCancel<T> extends IPrompt<T> {
}

export interface IPromptResult<T> extends ICheckboxResult {

	/**
	 * The result of the `IPromptButton` that was pressed or `undefined` if none.
	 */
	readonly result?: T;
}

export interface IPromptResultWithCancel<T> extends IPromptResult<T> {
	readonly result: T;
}

export type DialogType = 'none' | 'info' | 'error' | 'question' | 'warning';

export interface ICheckboxResult {

	/**
	 * This will only be defined if the confirmation was created
	 * with the checkbox option defined.
	 */
	readonly checkboxChecked?: boolean;
}

export const IDialogService = createDecorator<IDialogService>('dialogService');

/**
 * A service to bring up modal dialogs.
 *
 * Note: use the `INotificationService.prompt()` method for a non-modal way to ask
 * the user for input.
 */
export interface IDialogService {

	readonly _serviceBrand: undefined;

	/**
	 * Ask the user for confirmation with a modal dialog.
	 */
	confirm(confirmation: IConfirmation): Promise<IConfirmationResult>;

	/**
	 * Prompt the user with a modal dialog. Provides a bit
	 * more control over the dialog compared to the simpler
	 * `confirm` method. Specifically, allows to show more
	 * than 2 buttons and makes it easier to just show a
	 * message to the user.
	 *
	 * @returns a promise that resolves to the `T` result
	 * from the provided `IPromptButton<T>` or `undefined`.
	 */
	prompt<T>(prompt: IPromptWithCustomCancel<T>): Promise<IPromptResultWithCancel<T>>;
	prompt<T>(prompt: IPromptWithDefaultCancel<T>): Promise<IPromptResult<T>>;
	prompt<T>(prompt: IPrompt<T>): Promise<IPromptResult<T>>;

	/**
	 * Show a modal error dialog.
	 */
	error(message: string, detail?: string): Promise<void>;
}
