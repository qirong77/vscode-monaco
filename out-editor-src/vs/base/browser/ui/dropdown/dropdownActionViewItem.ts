
import { IContextMenuProvider } from '../../contextmenu.js';
import { $, append } from '../../dom.js';
import { IActionViewItemProvider } from '../actionbar/actionbar.js';
import { BaseActionViewItem, IBaseActionViewItemOptions } from '../actionbar/actionViewItems.js';
import { AnchorAlignment } from '../contextview/contextview.js';
import { DropdownMenu, IActionProvider, IDropdownMenuOptions, ILabelRenderer } from './dropdown.js';
import { IAction, IActionRunner } from '../../../common/actions.js';
import { Emitter } from '../../../common/event.js';
import { ResolvedKeybinding } from '../../../common/keybindings.js';
import { IDisposable } from '../../../common/lifecycle.js';
import './dropdown.css';
import { getDefaultHoverDelegate } from '../hover/hoverDelegateFactory.js';
import { getBaseLayerHoverDelegate } from '../hover/hoverDelegate2.js';

export interface IKeybindingProvider {
	(action: IAction): ResolvedKeybinding | undefined;
}

export interface IAnchorAlignmentProvider {
	(): AnchorAlignment;
}

export interface IDropdownMenuActionViewItemOptions extends IBaseActionViewItemOptions {
	readonly actionViewItemProvider?: IActionViewItemProvider;
	readonly keybindingProvider?: IKeybindingProvider;
	readonly actionRunner?: IActionRunner;
	readonly classNames?: string[] | string;
	readonly anchorAlignmentProvider?: IAnchorAlignmentProvider;
	readonly menuAsChild?: boolean;
	readonly skipTelemetry?: boolean;
}

export class DropdownMenuActionViewItem extends BaseActionViewItem {
	private menuActionsOrProvider: readonly IAction[] | IActionProvider;
	private dropdownMenu: DropdownMenu | undefined;
	private contextMenuProvider: IContextMenuProvider;
	private actionItem: HTMLElement | null = null;

	private _onDidChangeVisibility = this._register(new Emitter<boolean>());
	readonly onDidChangeVisibility = this._onDidChangeVisibility.event;

	protected override readonly options: IDropdownMenuActionViewItemOptions;

	constructor(
		action: IAction,
		menuActionsOrProvider: readonly IAction[] | IActionProvider,
		contextMenuProvider: IContextMenuProvider,
		options: IDropdownMenuActionViewItemOptions = Object.create(null)
	) {
		super(null, action, options);

		this.menuActionsOrProvider = menuActionsOrProvider;
		this.contextMenuProvider = contextMenuProvider;
		this.options = options;

		if (this.options.actionRunner) {
			this.actionRunner = this.options.actionRunner;
		}
	}

	override render(container: HTMLElement): void {
		this.actionItem = container;

		const labelRenderer: ILabelRenderer = (el: HTMLElement): IDisposable | null => {
			this.element = append(el, $('a.action-label'));

			let classNames: string[] = [];

			if (typeof this.options.classNames === 'string') {
				classNames = this.options.classNames.split(/\s+/g).filter(s => !!s);
			} else if (this.options.classNames) {
				classNames = this.options.classNames;
			}

			// todo@aeschli: remove codicon, should come through `this.options.classNames`
			if (!classNames.find(c => c === 'icon')) {
				classNames.push('codicon');
			}

			this.element.classList.add(...classNames);

			this.element.setAttribute('role', 'button');
			this.element.setAttribute('aria-haspopup', 'true');
			this.element.setAttribute('aria-expanded', 'false');
			if (this._action.label) {
				this._register(getBaseLayerHoverDelegate().setupManagedHover(this.options.hoverDelegate ?? getDefaultHoverDelegate('mouse'), this.element, this._action.label));
			}
			this.element.ariaLabel = this._action.label || '';

			return null;
		};

		const isActionsArray = Array.isArray(this.menuActionsOrProvider);
		const options: IDropdownMenuOptions = {
			contextMenuProvider: this.contextMenuProvider,
			labelRenderer: labelRenderer,
			menuAsChild: this.options.menuAsChild,
			actions: isActionsArray ? this.menuActionsOrProvider as IAction[] : undefined,
			actionProvider: isActionsArray ? undefined : this.menuActionsOrProvider as IActionProvider,
			skipTelemetry: this.options.skipTelemetry
		};

		this.dropdownMenu = this._register(new DropdownMenu(container, options));
		this._register(this.dropdownMenu.onDidChangeVisibility(visible => {
			this.element?.setAttribute('aria-expanded', `${visible}`);
			this._onDidChangeVisibility.fire(visible);
		}));

		this.dropdownMenu.menuOptions = {
			actionViewItemProvider: this.options.actionViewItemProvider,
			actionRunner: this.actionRunner,
			getKeyBinding: this.options.keybindingProvider,
			context: this._context
		};

		if (this.options.anchorAlignmentProvider) {
			const that = this;

			this.dropdownMenu.menuOptions = {
				...this.dropdownMenu.menuOptions,
				get anchorAlignment(): AnchorAlignment {
					return that.options.anchorAlignmentProvider!();
				}
			};
		}

		this.updateTooltip();
		this.updateEnabled();
	}

	protected override getTooltip(): string | undefined {
		let title: string | null = null;

		if (this.action.tooltip) {
			title = this.action.tooltip;
		} else if (this.action.label) {
			title = this.action.label;
		}

		return title ?? undefined;
	}

	override setActionContext(newContext: unknown): void {
		super.setActionContext(newContext);

		if (this.dropdownMenu) {
			if (this.dropdownMenu.menuOptions) {
				this.dropdownMenu.menuOptions.context = newContext;
			} else {
				this.dropdownMenu.menuOptions = { context: newContext };
			}
		}
	}

	show(): void {
		this.dropdownMenu?.show();
	}

	protected override updateEnabled(): void {
		const disabled = !this.action.enabled;
		this.actionItem?.classList.toggle('disabled', disabled);
		this.element?.classList.toggle('disabled', disabled);
	}
}
