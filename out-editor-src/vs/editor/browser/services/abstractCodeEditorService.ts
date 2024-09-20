
import { Emitter, Event } from '../../../base/common/event.js';
import { IDisposable, Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { LinkedList } from '../../../base/common/linkedList.js';
import { URI } from '../../../base/common/uri.js';
import { ICodeEditor, IDiffEditor } from '../editorBrowser.js';
import { ICodeEditorOpenHandler, ICodeEditorService } from './codeEditorService.js';
import { IResourceEditorInput } from '../../../platform/editor/common/editor.js';
import { IThemeService } from '../../../platform/theme/common/themeService.js';

export abstract class AbstractCodeEditorService extends Disposable implements ICodeEditorService {

	declare readonly _serviceBrand: undefined;

	private readonly _onWillCreateCodeEditor = this._register(new Emitter<void>());

	private readonly _onCodeEditorAdd: Emitter<ICodeEditor> = this._register(new Emitter<ICodeEditor>());
	public readonly onCodeEditorAdd: Event<ICodeEditor> = this._onCodeEditorAdd.event;

	private readonly _onCodeEditorRemove: Emitter<ICodeEditor> = this._register(new Emitter<ICodeEditor>());
	public readonly onCodeEditorRemove: Event<ICodeEditor> = this._onCodeEditorRemove.event;

	private readonly _onWillCreateDiffEditor = this._register(new Emitter<void>());

	private readonly _onDiffEditorAdd: Emitter<IDiffEditor> = this._register(new Emitter<IDiffEditor>());
	public readonly onDiffEditorAdd: Event<IDiffEditor> = this._onDiffEditorAdd.event;

	private readonly _onDiffEditorRemove: Emitter<IDiffEditor> = this._register(new Emitter<IDiffEditor>());
	public readonly onDiffEditorRemove: Event<IDiffEditor> = this._onDiffEditorRemove.event;

	private readonly _codeEditors: { [editorId: string]: ICodeEditor };
	private readonly _diffEditors: { [editorId: string]: IDiffEditor };
	protected _globalStyleSheet: GlobalStyleSheet | null;
	private readonly _decorationOptionProviders = new Map<string, IModelDecorationOptionsProvider>();
	private readonly _codeEditorOpenHandlers = new LinkedList<ICodeEditorOpenHandler>();

	constructor(
		@IThemeService private readonly _themeService: IThemeService,
	) {
		super();
		this._codeEditors = Object.create(null);
		this._diffEditors = Object.create(null);
		this._globalStyleSheet = null;
	}

	willCreateCodeEditor(): void {
		this._onWillCreateCodeEditor.fire();
	}

	addCodeEditor(editor: ICodeEditor): void {
		this._codeEditors[editor.getId()] = editor;
		this._onCodeEditorAdd.fire(editor);
	}

	removeCodeEditor(editor: ICodeEditor): void {
		if (delete this._codeEditors[editor.getId()]) {
			this._onCodeEditorRemove.fire(editor);
		}
	}

	listCodeEditors(): ICodeEditor[] {
		return Object.keys(this._codeEditors).map(id => this._codeEditors[id]);
	}

	willCreateDiffEditor(): void {
		this._onWillCreateDiffEditor.fire();
	}

	addDiffEditor(editor: IDiffEditor): void {
		this._diffEditors[editor.getId()] = editor;
		this._onDiffEditorAdd.fire(editor);
	}

	listDiffEditors(): IDiffEditor[] {
		return Object.keys(this._diffEditors).map(id => this._diffEditors[id]);
	}

	getFocusedCodeEditor(): ICodeEditor | null {
		let editorWithWidgetFocus: ICodeEditor | null = null;

		const editors = this.listCodeEditors();
		for (const editor of editors) {

			if (editor.hasTextFocus()) {
				// bingo!
				return editor;
			}

			if (editor.hasWidgetFocus()) {
				editorWithWidgetFocus = editor;
			}
		}

		return editorWithWidgetFocus;
	}

	public removeDecorationType(key: string): void {
		const provider = this._decorationOptionProviders.get(key);
		if (provider) {
			provider.refCount--;
			if (provider.refCount <= 0) {
				this._decorationOptionProviders.delete(key);
				provider.dispose();
				this.listCodeEditors().forEach((ed) => ed.removeDecorationsByType(key));
			}
		}
	}
	private readonly _modelProperties = new Map<string, Map<string, any>>();

	public setModelProperty(resource: URI, key: string, value: any): void {
		const key1 = resource.toString();
		let dest: Map<string, any>;
		if (this._modelProperties.has(key1)) {
			dest = this._modelProperties.get(key1)!;
		} else {
			dest = new Map<string, any>();
			this._modelProperties.set(key1, dest);
		}

		dest.set(key, value);
	}

	public getModelProperty(resource: URI, key: string): any {
		const key1 = resource.toString();
		if (this._modelProperties.has(key1)) {
			const innerMap = this._modelProperties.get(key1)!;
			return innerMap.get(key);
		}
		return undefined;
	}

	abstract getActiveCodeEditor(): ICodeEditor | null;

	async openCodeEditor(input: IResourceEditorInput, source: ICodeEditor | null, sideBySide?: boolean): Promise<ICodeEditor | null> {
		for (const handler of this._codeEditorOpenHandlers) {
			const candidate = await handler(input, source, sideBySide);
			if (candidate !== null) {
				return candidate;
			}
		}
		return null;
	}

	registerCodeEditorOpenHandler(handler: ICodeEditorOpenHandler): IDisposable {
		const rm = this._codeEditorOpenHandlers.unshift(handler);
		return toDisposable(rm);
	}
}

export class GlobalStyleSheet {
	private readonly _styleSheet: HTMLStyleElement;

	constructor(styleSheet: HTMLStyleElement) {
		this._styleSheet = styleSheet;
	}
}

interface IModelDecorationOptionsProvider extends IDisposable {
	refCount: number;
}
