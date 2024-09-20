
// This file is adding references to various symbols which should not be removed via tree shaking

import { IObservable } from './vs/base/common/observable';

import { ServiceIdentifier } from './vs/platform/instantiation/common/instantiation';
import { create as create1 } from './vs/base/common/worker/simpleWorker';
import { create as create2 } from './vs/editor/common/services/editorSimpleWorker';
import { SyncDescriptor0 } from './vs/platform/instantiation/common/descriptors';
import * as editorAPI from './vs/editor/editor.api';

(function () {
	var a: any;
	var b: any;
	a = (<ServiceIdentifier<any>>b).type;
	a = create1;
	a = create2;

	// injection madness
	a = (<SyncDescriptor0<any>>b).ctor;

	// exported API
	a = editorAPI.CancellationTokenSource;
	a = editorAPI.Emitter;
	a = editorAPI.KeyCode;
	a = editorAPI.KeyMod;
	a = editorAPI.Position;
	a = editorAPI.Range;
	a = editorAPI.Selection;
	a = editorAPI.SelectionDirection;
	a = editorAPI.MarkerSeverity;
	a = editorAPI.MarkerTag;
	a = editorAPI.Uri;
	a = editorAPI.Token;
	a = editorAPI.editor;
	a = editorAPI.languages;

	const o: IObservable<number, number> = null!;
	o.TChange;
})();
