
import { addDisposableListener, EventHelper, EventType, IFocusTracker, reset, trackFocus } from '../../dom.js';
import { sanitize } from '../../dompurify/dompurify.js';
import { StandardKeyboardEvent } from '../../keyboardEvent.js';
import { renderMarkdown, renderStringAsPlaintext } from '../../markdownRenderer.js';
import { Gesture, EventType as TouchEventType } from '../../touch.js';
import { getDefaultHoverDelegate } from '../hover/hoverDelegateFactory.js';
import { IHoverDelegate } from '../hover/hoverDelegate.js';
import { renderLabelWithIcons } from '../iconLabel/iconLabels.js';
import { Color } from '../../../common/color.js';
import { Event as BaseEvent, Emitter } from '../../../common/event.js';
import { IMarkdownString, isMarkdownString, markdownStringEqual } from '../../../common/htmlContent.js';
import { KeyCode } from '../../../common/keyCodes.js';
import { Disposable, IDisposable } from '../../../common/lifecycle.js';
import { ThemeIcon } from '../../../common/themables.js';
import './button.css';
import { IManagedHover } from '../hover/hover.js';
import { getBaseLayerHoverDelegate } from '../hover/hoverDelegate2.js';

export interface IButtonOptions extends Partial<IButtonStyles> {
	readonly title?: boolean | string;
	readonly ariaLabel?: boolean | string;
	readonly supportIcons?: boolean;
	readonly supportShortLabel?: boolean;
	readonly secondary?: boolean;
	readonly hoverDelegate?: IHoverDelegate;
}

export interface IButtonStyles {
	readonly buttonBackground: string | undefined;
	readonly buttonHoverBackground: string | undefined;
	readonly buttonForeground: string | undefined;
	readonly buttonSeparator: string | undefined;
	readonly buttonSecondaryBackground: string | undefined;
	readonly buttonSecondaryHoverBackground: string | undefined;
	readonly buttonSecondaryForeground: string | undefined;
	readonly buttonBorder: string | undefined;
}

export const unthemedButtonStyles: IButtonStyles = {
	buttonBackground: '#0E639C',
	buttonHoverBackground: '#006BB3',
	buttonSeparator: Color.white.toString(),
	buttonForeground: Color.white.toString(),
	buttonBorder: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined
};

export interface IButton extends IDisposable {

	set label(value: string | IMarkdownString);
	set icon(value: ThemeIcon);
	set enabled(value: boolean);
}

export class Button extends Disposable implements IButton {

	protected options: IButtonOptions;
	protected _element: HTMLElement;
	protected _label: string | IMarkdownString = '';
	protected _labelElement: HTMLElement | undefined;
	protected _labelShortElement: HTMLElement | undefined;
	private _hover: IManagedHover | undefined;

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	private _onDidEscape = this._register(new Emitter<Event>());

	private focusTracker: IFocusTracker;

	constructor(container: HTMLElement, options: IButtonOptions) {
		super();

		this.options = options;

		this._element = document.createElement('a');
		this._element.classList.add('monaco-button');
		this._element.tabIndex = 0;
		this._element.setAttribute('role', 'button');

		this._element.classList.toggle('secondary', !!options.secondary);
		const background = options.secondary ? options.buttonSecondaryBackground : options.buttonBackground;
		const foreground = options.secondary ? options.buttonSecondaryForeground : options.buttonForeground;

		this._element.style.color = foreground || '';
		this._element.style.backgroundColor = background || '';

		if (options.supportShortLabel) {
			this._labelShortElement = document.createElement('div');
			this._labelShortElement.classList.add('monaco-button-label-short');
			this._element.appendChild(this._labelShortElement);

			this._labelElement = document.createElement('div');
			this._labelElement.classList.add('monaco-button-label');
			this._element.appendChild(this._labelElement);

			this._element.classList.add('monaco-text-button-with-short-label');
		}

		if (typeof options.title === 'string') {
			this.setTitle(options.title);
		}

		if (typeof options.ariaLabel === 'string') {
			this._element.setAttribute('aria-label', options.ariaLabel);
		}
		container.appendChild(this._element);

		this._register(Gesture.addTarget(this._element));

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(addDisposableListener(this._element, eventType, e => {
				if (!this.enabled) {
					EventHelper.stop(e);
					return;
				}

				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			let eventHandled = false;
			if (this.enabled && (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space))) {
				this._onDidClick.fire(e);
				eventHandled = true;
			} else if (event.equals(KeyCode.Escape)) {
				this._onDidEscape.fire(e);
				this._element.blur();
				eventHandled = true;
			}

			if (eventHandled) {
				EventHelper.stop(event, true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.updateBackground(true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.updateBackground(false); // restore standard styles
		}));

		// Also set hover background when button is focused for feedback
		this.focusTracker = this._register(trackFocus(this._element));
		this._register(this.focusTracker.onDidFocus(() => { if (this.enabled) { this.updateBackground(true); } }));
		this._register(this.focusTracker.onDidBlur(() => { if (this.enabled) { this.updateBackground(false); } }));
	}

	public override dispose(): void {
		super.dispose();
		this._element.remove();
	}

	private getContentElements(content: string): HTMLElement[] {
		const elements: HTMLSpanElement[] = [];
		for (let segment of renderLabelWithIcons(content)) {
			if (typeof (segment) === 'string') {
				segment = segment.trim();

				// Ignore empty segment
				if (segment === '') {
					continue;
				}

				// Convert string segments to <span> nodes
				const node = document.createElement('span');
				node.textContent = segment;
				elements.push(node);
			} else {
				elements.push(segment);
			}
		}

		return elements;
	}

	private updateBackground(hover: boolean): void {
		let background;
		if (this.options.secondary) {
			background = hover ? this.options.buttonSecondaryHoverBackground : this.options.buttonSecondaryBackground;
		} else {
			background = hover ? this.options.buttonHoverBackground : this.options.buttonBackground;
		}
		if (background) {
			this._element.style.backgroundColor = background;
		}
	}

	get element(): HTMLElement {
		return this._element;
	}

	set label(value: string | IMarkdownString) {
		if (this._label === value) {
			return;
		}

		if (isMarkdownString(this._label) && isMarkdownString(value) && markdownStringEqual(this._label, value)) {
			return;
		}

		this._element.classList.add('monaco-text-button');
		const labelElement = this.options.supportShortLabel ? this._labelElement! : this._element;

		if (isMarkdownString(value)) {
			const rendered = renderMarkdown(value, { inline: true });
			rendered.dispose();

			// Don't include outer `<p>`
			const root = rendered.element.querySelector('p')?.innerHTML;
			if (root) {
				// Only allow a very limited set of inline html tags
				const sanitized = sanitize(root, { ADD_TAGS: ['b', 'i', 'u', 'code', 'span'], ALLOWED_ATTR: ['class'], RETURN_TRUSTED_TYPE: true });
				labelElement.innerHTML = sanitized as unknown as string;
			} else {
				reset(labelElement);
			}
		} else {
			if (this.options.supportIcons) {
				reset(labelElement, ...this.getContentElements(value));
			} else {
				labelElement.textContent = value;
			}
		}

		let title: string = '';
		if (typeof this.options.title === 'string') {
			title = this.options.title;
		} else if (this.options.title) {
			title = renderStringAsPlaintext(value);
		}

		this.setTitle(title);

		if (typeof this.options.ariaLabel === 'string') {
			this._element.setAttribute('aria-label', this.options.ariaLabel);
		} else if (this.options.ariaLabel) {
			this._element.setAttribute('aria-label', title);
		}

		this._label = value;
	}

	get label(): string | IMarkdownString {
		return this._label;
	}

	set icon(icon: ThemeIcon) {
		this._element.classList.add(...ThemeIcon.asClassNameArray(icon));
	}

	set enabled(value: boolean) {
		if (value) {
			this._element.classList.remove('disabled');
			this._element.setAttribute('aria-disabled', String(false));
			this._element.tabIndex = 0;
		} else {
			this._element.classList.add('disabled');
			this._element.setAttribute('aria-disabled', String(true));
		}
	}

	get enabled() {
		return !this._element.classList.contains('disabled');
	}

	setTitle(title: string) {
		if (!this._hover && title !== '') {
			this._hover = this._register(getBaseLayerHoverDelegate().setupManagedHover(this.options.hoverDelegate ?? getDefaultHoverDelegate('mouse'), this._element, title));
		} else if (this._hover) {
			this._hover.update(title);
		}
	}
}
