
import { IDisposable } from '../../../base/common/lifecycle.js';
import BaseSeverity from '../../../base/common/severity.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export import Severity = BaseSeverity;

export const INotificationService = createDecorator<INotificationService>('notificationService');

export type NotificationMessage = string | Error;

export interface INotificationProperties {
}

export interface INotificationSource {
}

export interface INotification extends INotificationProperties {

	/**
	 * The severity of the notification. Either `Info`, `Warning` or `Error`.
	 */
	readonly severity: Severity;

	/**
	 * The message of the notification. This can either be a `string` or `Error`. Messages
	 * can optionally include links in the format: `[text](link)`
	 */
	readonly message: NotificationMessage;

	/**
	 * The source of the notification appears as additional information.
	 */
	readonly source?: string | INotificationSource;
}

export interface INotificationHandle {
}

interface IBasePromptChoice {

	/**
	 * Label to show for the choice to the user.
	 */
	readonly label: string;

	/**
	 * Triggered when the user selects the choice.
	 */
	run: () => void;
}

export interface IPromptChoice extends IBasePromptChoice {
}

export interface IPromptChoiceWithMenu extends IPromptChoice {
}

export interface IPromptOptions extends INotificationProperties {
}

export interface IStatusMessageOptions {

	/**
	 * An optional timeout after which the status message is to be hidden. By default
	 * the status message will not hide until another status message is displayed.
	 */
	readonly hideAfter?: number;
}

/**
 * A service to bring up notifications and non-modal prompts.
 *
 * Note: use the `IDialogService` for a modal way to ask the user for input.
 */
export interface INotificationService {

	readonly _serviceBrand: undefined;

	/**
	 * Show the provided notification to the user. The returned `INotificationHandle`
	 * can be used to control the notification afterwards.
	 *
	 * **Note:** If your intent is to show a message with actions to the user, consider
	 * the `INotificationService.prompt()` method instead which are optimized for
	 * this usecase and much easier to use!
	 *
	 * @returns a handle on the notification to e.g. hide it or update message, buttons, etc.
	 */
	notify(notification: INotification): INotificationHandle;

	/**
	 * A convenient way of reporting infos. Use the `INotificationService.notify`
	 * method if you need more control over the notification.
	 */
	info(message: NotificationMessage | NotificationMessage[]): void;

	/**
	 * A convenient way of reporting warnings. Use the `INotificationService.notify`
	 * method if you need more control over the notification.
	 */
	warn(message: NotificationMessage | NotificationMessage[]): void;

	/**
	 * A convenient way of reporting errors. Use the `INotificationService.notify`
	 * method if you need more control over the notification.
	 */
	error(message: NotificationMessage | NotificationMessage[]): void;

	/**
	 * Shows a prompt in the notification area with the provided choices. The prompt
	 * is non-modal. If you want to show a modal dialog instead, use `IDialogService`.
	 *
	 * @param severity the severity of the notification. Either `Info`, `Warning` or `Error`.
	 * @param message the message to show as status.
	 * @param choices options to be chosen from.
	 * @param options provides some optional configuration options.
	 *
	 * @returns a handle on the notification to e.g. hide it or update message, buttons, etc.
	 */
	prompt(severity: Severity, message: string, choices: (IPromptChoice | IPromptChoiceWithMenu)[], options?: IPromptOptions): INotificationHandle;

	/**
	 * Shows a status message in the status area with the provided text.
	 *
	 * @param message the message to show as status
	 * @param options provides some optional configuration options
	 *
	 * @returns a disposable to hide the status message
	 */
	status(message: NotificationMessage, options?: IStatusMessageOptions): IDisposable;
}

export class NoOpNotification implements INotificationHandle {
}
