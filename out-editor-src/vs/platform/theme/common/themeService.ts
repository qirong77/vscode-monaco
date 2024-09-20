
import { Color } from '../../../base/common/color.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, IDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import * as platform from '../../registry/common/platform.js';
import { ColorIdentifier } from './colorRegistry.js';
import { IconContribution, IconDefinition } from './iconRegistry.js';
import { ColorScheme } from './theme.js';

export const IThemeService = createDecorator<IThemeService>('themeService');

export function themeColorFromId(id: ColorIdentifier) {
	return { id };
}

export function getThemeTypeSelector(type: ColorScheme): string {
	switch (type) {
		case ColorScheme.DARK: return 'vs-dark';
		case ColorScheme.HIGH_CONTRAST_DARK: return 'hc-black';
		case ColorScheme.HIGH_CONTRAST_LIGHT: return 'hc-light';
		default: return 'vs';
	}
}

export interface ITokenStyle {
	readonly foreground: number | undefined;
	readonly bold: boolean | undefined;
	readonly underline: boolean | undefined;
	readonly strikethrough: boolean | undefined;
	readonly italic: boolean | undefined;
}

export interface IColorTheme {

	readonly type: ColorScheme;

	/**
	 * Resolves the color of the given color identifier. If the theme does not
	 * specify the color, the default color is returned unless <code>useDefault</code> is set to false.
	 * @param color the id of the color
	 * @param useDefault specifies if the default color should be used. If not set, the default is used.
	 */
	getColor(color: ColorIdentifier, useDefault?: boolean): Color | undefined;

	/**
	 * Returns whether the theme defines a value for the color. If not, that means the
	 * default color will be used.
	 */
	defines(color: ColorIdentifier): boolean;

	/**
	 * Returns the token style for a given classification. The result uses the <code>MetadataConsts</code> format
	 */
	getTokenStyleMetadata(type: string, modifiers: string[], modelLanguage: string): ITokenStyle | undefined;

	/**
	 * List of all colors used with tokens. <code>getTokenStyleMetadata</code> references the colors by index into this list.
	 */
	readonly tokenColorMap: string[];

	/**
	 * Defines whether semantic highlighting should be enabled for the theme.
	 */
	readonly semanticHighlighting: boolean;
}

export interface IFileIconTheme {
	readonly hasFileIcons: boolean;
	readonly hasFolderIcons: boolean;
	readonly hidesExplorerArrows: boolean;
}

export interface IProductIconTheme {
	/**
	 * Resolves the definition for the given icon as defined by the theme.
	 *
	 * @param iconContribution The icon
	 */
	getIcon(iconContribution: IconContribution): IconDefinition | undefined;
}


export interface ICssStyleCollector {
	addRule(rule: string): void;
}

export interface IThemingParticipant {
	(theme: IColorTheme, collector: ICssStyleCollector, environment: IEnvironmentService): void;
}

export interface IThemeService {
	readonly _serviceBrand: undefined;

	getColorTheme(): IColorTheme;

	readonly onDidColorThemeChange: Event<IColorTheme>;

	getFileIconTheme(): IFileIconTheme;

	getProductIconTheme(): IProductIconTheme;

	readonly onDidProductIconThemeChange: Event<IProductIconTheme>;

}

// static theming participant
export const Extensions = {
	ThemingContribution: 'base.contributions.theming'
};

export interface IThemingRegistry {

	getThemingParticipants(): IThemingParticipant[];
}

class ThemingRegistry implements IThemingRegistry {
	private themingParticipants: IThemingParticipant[] = [];
	private readonly onThemingParticipantAddedEmitter: Emitter<IThemingParticipant>;

	constructor() {
		this.themingParticipants = [];
		this.onThemingParticipantAddedEmitter = new Emitter<IThemingParticipant>();
	}

	public onColorThemeChange(participant: IThemingParticipant): IDisposable {
		this.themingParticipants.push(participant);
		this.onThemingParticipantAddedEmitter.fire(participant);
		return toDisposable(() => {
			const idx = this.themingParticipants.indexOf(participant);
			this.themingParticipants.splice(idx, 1);
		});
	}

	public getThemingParticipants(): IThemingParticipant[] {
		return this.themingParticipants;
	}
}

const themingRegistry = new ThemingRegistry();
platform.Registry.add(Extensions.ThemingContribution, themingRegistry);

export function registerThemingParticipant(participant: IThemingParticipant): IDisposable {
	return themingRegistry.onColorThemeChange(participant);
}

/**
 * Utility base class for all themable components.
 */
export class Themable extends Disposable {
	protected theme: IColorTheme;

	constructor(
		protected themeService: IThemeService
	) {
		super();

		this.theme = themeService.getColorTheme();

		// Hook up to theme changes
		this._register(this.themeService.onDidColorThemeChange(theme => this.onThemeChange(theme)));
	}

	protected onThemeChange(theme: IColorTheme): void {
		this.theme = theme;

		this.updateStyles();
	}

	updateStyles(): void {
		// Subclasses to override
	}
}
