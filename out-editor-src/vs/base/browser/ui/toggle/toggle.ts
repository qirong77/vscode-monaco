/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IKeyboardEvent } from '../../keyboardEvent.js';
import { Widget } from '../widget.js';
import { ThemeIcon } from '../../../common/themables.js';
import { Emitter, Event } from '../../../common/event.js';
import { KeyCode } from '../../../common/keyCodes.js';
import './toggle.css';
import { getDefaultHoverDelegate } from '../hover/hoverDelegateFactory.js';
import { IHoverDelegate } from '../hover/hoverDelegate.js';
import { IManagedHover } from '../hover/hover.js';
import { getBaseLayerHoverDelegate } from '../hover/hoverDelegate2.js';

export interface IToggleOpts extends IToggleStyles {
	readonly actionClassName?: string;
	readonly icon?: ThemeIcon;
	readonly title: string;
	readonly isChecked: boolean;
	readonly notFocusable?: boolean;
	readonly hoverDelegate?: IHoverDelegate;
}

export interface IToggleStyles {
	readonly inputActiveOptionBorder: string | undefined;
	readonly inputActiveOptionForeground: string | undefined;
	readonly inputActiveOptionBackground: string | undefined;
}

export interface ICheckboxStyles {
	readonly checkboxBackground: string | undefined;
	readonly checkboxBorder: string | undefined;
	readonly checkboxForeground: string | undefined;
}

export const unthemedToggleStyles = {
	inputActiveOptionBorder: '#007ACC00',
	inputActiveOptionForeground: '#FFFFFF',
	inputActiveOptionBackground: '#0E639C50'
};

export class Toggle extends Widget {

	private readonly _onChange = this._register(new Emitter<boolean>());
	readonly onChange: Event<boolean /* via keyboard */> = this._onChange.event;

	private readonly _onKeyDown = this._register(new Emitter<IKeyboardEvent>());
	readonly onKeyDown: Event<IKeyboardEvent> = this._onKeyDown.event;

	private readonly _opts: IToggleOpts;
	private _icon: ThemeIcon | undefined;
	readonly domNode: HTMLElement;

	private _checked: boolean;
	private _hover: IManagedHover;

	constructor(opts: IToggleOpts) {
		super();

		this._opts = opts;
		this._checked = this._opts.isChecked;

		const classes = ['monaco-custom-toggle'];
		if (this._opts.icon) {
			this._icon = this._opts.icon;
			classes.push(...ThemeIcon.asClassNameArray(this._icon));
		}
		if (this._opts.actionClassName) {
			classes.push(...this._opts.actionClassName.split(' '));
		}
		if (this._checked) {
			classes.push('checked');
		}

		this.domNode = document.createElement('div');
		this._hover = this._register(getBaseLayerHoverDelegate().setupManagedHover(opts.hoverDelegate ?? getDefaultHoverDelegate('mouse'), this.domNode, this._opts.title));
		this.domNode.classList.add(...classes);
		if (!this._opts.notFocusable) {
			this.domNode.tabIndex = 0;
		}
		this.domNode.setAttribute('role', 'checkbox');
		this.domNode.setAttribute('aria-checked', String(this._checked));
		this.domNode.setAttribute('aria-label', this._opts.title);

		this.applyStyles();

		this.onclick(this.domNode, (ev) => {
			if (this.enabled) {
				this.checked = !this._checked;
				this._onChange.fire(false);
				ev.preventDefault();
			}
		});

		this._register(this.ignoreGesture(this.domNode));

		this.onkeydown(this.domNode, (keyboardEvent) => {
			if (keyboardEvent.keyCode === KeyCode.Space || keyboardEvent.keyCode === KeyCode.Enter) {
				this.checked = !this._checked;
				this._onChange.fire(true);
				keyboardEvent.preventDefault();
				keyboardEvent.stopPropagation();
				return;
			}

			this._onKeyDown.fire(keyboardEvent);
		});
	}

	get enabled(): boolean {
		return this.domNode.getAttribute('aria-disabled') !== 'true';
	}

	focus(): void {
		this.domNode.focus();
	}

	get checked(): boolean {
		return this._checked;
	}

	set checked(newIsChecked: boolean) {
		this._checked = newIsChecked;

		this.domNode.setAttribute('aria-checked', String(this._checked));
		this.domNode.classList.toggle('checked', this._checked);

		this.applyStyles();
	}

	width(): number {
		return 2 /*margin left*/ + 2 /*border*/ + 2 /*padding*/ + 16 /* icon width */;
	}

	protected applyStyles(): void {
		if (this.domNode) {
			this.domNode.style.borderColor = (this._checked && this._opts.inputActiveOptionBorder) || '';
			this.domNode.style.color = (this._checked && this._opts.inputActiveOptionForeground) || 'inherit';
			this.domNode.style.backgroundColor = (this._checked && this._opts.inputActiveOptionBackground) || '';
		}
	}

	enable(): void {
		this.domNode.setAttribute('aria-disabled', String(false));
	}

	disable(): void {
		this.domNode.setAttribute('aria-disabled', String(true));
	}
}
