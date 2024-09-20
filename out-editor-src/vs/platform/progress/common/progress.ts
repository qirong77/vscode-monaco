
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IProgressService = createDecorator<IProgressService>('progressService');

/**
 * A progress service that can be used to report progress to various locations of the UI.
 */
export interface IProgressService {

	readonly _serviceBrand: undefined;

	withProgress<R>(
		options: IProgressOptions | IProgressDialogOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
		task: (progress: IProgress<IProgressStep>) => Promise<R>,
		onDidCancel?: (choice?: number) => void
	): Promise<R>;
}

export interface IProgressIndicator {

	/**
	 * Show progress customized with the provided flags.
	 */
	show(infinite: true, delay?: number): IProgressRunner;
	show(total: number, delay?: number): IProgressRunner;

	/**
	 * Indicate progress for the duration of the provided promise. Progress will stop in
	 * any case of promise completion, error or cancellation.
	 */
	showWhile(promise: Promise<unknown>, delay?: number): Promise<void>;
}

export const enum ProgressLocation {
	Explorer = 1,
	Scm = 3,
	Extensions = 5,
	Window = 10,
	Notification = 15,
	Dialog = 20
}

export interface IProgressOptions {
	readonly location: ProgressLocation | string;
	readonly title?: string;
}

export interface IProgressNotificationOptions extends IProgressOptions {
}

export interface IProgressDialogOptions extends IProgressOptions {
}

export interface IProgressWindowOptions extends IProgressOptions {
}

export interface IProgressCompositeOptions extends IProgressOptions {
}

export interface IProgressStep {
}

export interface IProgressRunner {
	total(value: number): void;
	worked(value: number): void;
	done(): void;
}

export const emptyProgressRunner = Object.freeze<IProgressRunner>({
	total() { },
	worked() { },
	done() { }
});

export interface IProgress<T> {
	report(item: T): void;
}

export class Progress<T> implements IProgress<T> {

	static readonly None = Object.freeze<IProgress<unknown>>({ report() { } });

	private _value?: T;

	constructor(private callback: (data: T) => unknown) {
	}

	report(item: T) {
		this._value = item;
		this.callback(this._value);
	}
}

export const IEditorProgressService = createDecorator<IEditorProgressService>('editorProgressService');

/**
 * A progress service that will report progress local to the editor triggered from.
 */
export interface IEditorProgressService extends IProgressIndicator {

	readonly _serviceBrand: undefined;
}
