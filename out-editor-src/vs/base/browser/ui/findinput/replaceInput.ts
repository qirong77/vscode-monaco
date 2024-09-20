/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../dom.js';
import { IKeyboardEvent } from '../../keyboardEvent.js';
import { IMouseEvent } from '../../mouseEvent.js';
import { IToggleStyles, Toggle } from '../toggle/toggle.js';
import { IContextViewProvider } from '../contextview/contextview.js';
import { IFindInputToggleOpts } from './findInputToggles.js';
import { HistoryInputBox, IInputBoxStyles, IInputValidator } from '../inputbox/inputBox.js';
import { Widget } from '../widget.js';
import { Codicon } from '../../../common/codicons.js';
import { Emitter, Event } from '../../../common/event.js';
import { KeyCode } from '../../../common/keyCodes.js';
import './findInput.css';
import * as nls from '../../../../nls.js';
import { getDefaultHoverDelegate } from '../hover/hoverDelegateFactory.js';


export interface IReplaceInputOptions {
	readonly placeholder?: string;
	readonly validation?: IInputValidator;
	readonly label: string;
	readonly flexibleHeight?: boolean;
	readonly flexibleWidth?: boolean;
	readonly flexibleMaxHeight?: number;

	readonly appendPreserveCaseLabel?: string;
	readonly history?: string[];
	readonly showHistoryHint?: () => boolean;
	readonly inputBoxStyles: IInputBoxStyles;
	readonly toggleStyles: IToggleStyles;
}

const NLS_DEFAULT_LABEL = nls.localize('defaultLabel', "input");
const NLS_PRESERVE_CASE_LABEL = nls.localize('label.preserveCaseToggle', "Preserve Case");

class PreserveCaseToggle extends Toggle {
	constructor(opts: IFindInputToggleOpts) {
		super({
			// TODO: does this need its own icon?
			icon: Codicon.preserveCase,
			title: NLS_PRESERVE_CASE_LABEL + opts.appendTitle,
			isChecked: opts.isChecked,
			hoverDelegate: opts.hoverDelegate ?? getDefaultHoverDelegate('element'),
			inputActiveOptionBorder: opts.inputActiveOptionBorder,
			inputActiveOptionForeground: opts.inputActiveOptionForeground,
			inputActiveOptionBackground: opts.inputActiveOptionBackground,
		});
	}
}

export class ReplaceInput extends Widget {

	private contextViewProvider: IContextViewProvider | undefined;
	private placeholder: string;
	private validation?: IInputValidator;
	private label: string;
	private fixFocusOnOptionClickEnabled = true;

	private preserveCase: PreserveCaseToggle;
	private cachedOptionsWidth: number = 0;
	public domNode: HTMLElement;
	public inputBox: HistoryInputBox;

	private readonly _onDidOptionChange = this._register(new Emitter<boolean>());
	public readonly onDidOptionChange: Event<boolean /* via keyboard */> = this._onDidOptionChange.event;

	private readonly _onKeyDown = this._register(new Emitter<IKeyboardEvent>());
	public readonly onKeyDown: Event<IKeyboardEvent> = this._onKeyDown.event;

	private readonly _onMouseDown = this._register(new Emitter<IMouseEvent>());

	private readonly _onInput = this._register(new Emitter<void>());

	private readonly _onKeyUp = this._register(new Emitter<IKeyboardEvent>());

	private _onPreserveCaseKeyDown = this._register(new Emitter<IKeyboardEvent>());
	public readonly onPreserveCaseKeyDown: Event<IKeyboardEvent> = this._onPreserveCaseKeyDown.event;

	constructor(parent: HTMLElement | null, contextViewProvider: IContextViewProvider | undefined, private readonly _showOptionButtons: boolean, options: IReplaceInputOptions) {
		super();
		this.contextViewProvider = contextViewProvider;
		this.placeholder = options.placeholder || '';
		this.validation = options.validation;
		this.label = options.label || NLS_DEFAULT_LABEL;

		const appendPreserveCaseLabel = options.appendPreserveCaseLabel || '';
		const history = options.history || [];
		const flexibleHeight = !!options.flexibleHeight;
		const flexibleWidth = !!options.flexibleWidth;
		const flexibleMaxHeight = options.flexibleMaxHeight;

		this.domNode = document.createElement('div');
		this.domNode.classList.add('monaco-findInput');

		this.inputBox = this._register(new HistoryInputBox(this.domNode, this.contextViewProvider, {
			ariaLabel: this.label || '',
			placeholder: this.placeholder || '',
			validationOptions: {
				validation: this.validation
			},
			history,
			showHistoryHint: options.showHistoryHint,
			flexibleHeight,
			flexibleWidth,
			flexibleMaxHeight,
			inputBoxStyles: options.inputBoxStyles
		}));

		this.preserveCase = this._register(new PreserveCaseToggle({
			appendTitle: appendPreserveCaseLabel,
			isChecked: false,
			...options.toggleStyles
		}));
		this._register(this.preserveCase.onChange(viaKeyboard => {
			this._onDidOptionChange.fire(viaKeyboard);
			if (!viaKeyboard && this.fixFocusOnOptionClickEnabled) {
				this.inputBox.focus();
			}
			this.validate();
		}));
		this._register(this.preserveCase.onKeyDown(e => {
			this._onPreserveCaseKeyDown.fire(e);
		}));

		if (this._showOptionButtons) {
			this.cachedOptionsWidth = this.preserveCase.width();
		} else {
			this.cachedOptionsWidth = 0;
		}

		// Arrow-Key support to navigate between options
		const indexes = [this.preserveCase.domNode];
		this.onkeydown(this.domNode, (event: IKeyboardEvent) => {
			if (event.equals(KeyCode.LeftArrow) || event.equals(KeyCode.RightArrow) || event.equals(KeyCode.Escape)) {
				const index = indexes.indexOf(<HTMLElement>this.domNode.ownerDocument.activeElement);
				if (index >= 0) {
					let newIndex: number = -1;
					if (event.equals(KeyCode.RightArrow)) {
						newIndex = (index + 1) % indexes.length;
					} else if (event.equals(KeyCode.LeftArrow)) {
						if (index === 0) {
							newIndex = indexes.length - 1;
						} else {
							newIndex = index - 1;
						}
					}

					if (event.equals(KeyCode.Escape)) {
						indexes[index].blur();
						this.inputBox.focus();
					} else if (newIndex >= 0) {
						indexes[newIndex].focus();
					}

					dom.EventHelper.stop(event, true);
				}
			}
		});


		const controls = document.createElement('div');
		controls.className = 'controls';
		controls.style.display = this._showOptionButtons ? 'block' : 'none';
		controls.appendChild(this.preserveCase.domNode);

		this.domNode.appendChild(controls);

		parent?.appendChild(this.domNode);

		this.onkeydown(this.inputBox.inputElement, (e) => this._onKeyDown.fire(e));
		this.onkeyup(this.inputBox.inputElement, (e) => this._onKeyUp.fire(e));
		this.oninput(this.inputBox.inputElement, (e) => this._onInput.fire());
		this.onmousedown(this.inputBox.inputElement, (e) => this._onMouseDown.fire(e));
	}

	public enable(): void {
		this.domNode.classList.remove('disabled');
		this.inputBox.enable();
		this.preserveCase.enable();
	}

	public disable(): void {
		this.domNode.classList.add('disabled');
		this.inputBox.disable();
		this.preserveCase.disable();
	}

	public setEnabled(enabled: boolean): void {
		if (enabled) {
			this.enable();
		} else {
			this.disable();
		}
	}

	public select(): void {
		this.inputBox.select();
	}

	public focus(): void {
		this.inputBox.focus();
	}

	public getPreserveCase(): boolean {
		return this.preserveCase.checked;
	}

	public setPreserveCase(value: boolean): void {
		this.preserveCase.checked = value;
	}

	public focusOnPreserve(): void {
		this.preserveCase.focus();
	}

	public validate(): void {
		this.inputBox?.validate();
	}

	public set width(newWidth: number) {
		this.inputBox.paddingRight = this.cachedOptionsWidth;
		this.domNode.style.width = newWidth + 'px';
	}

	public override dispose(): void {
		super.dispose();
	}
}
