/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IIdentityProvider, IListVirtualDelegate } from '../list/list.js';
import { AbstractTree, IAbstractTreeOptions } from './abstractTree.js';
import { ObjectTreeModel } from './objectTreeModel.js';
import { IDataSource, ITreeModel, ITreeRenderer } from './tree.js';

export interface IDataTreeOptions<T, TFilterData = void> extends IAbstractTreeOptions<T, TFilterData> {
}

export class DataTree<TInput, T, TFilterData = void> extends AbstractTree<T | null, TFilterData, T | null> {

	protected declare model: ObjectTreeModel<T, TFilterData>;

	private identityProvider: IIdentityProvider<T> | undefined;

	constructor(
		private user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<T>,
		renderers: ITreeRenderer<T, TFilterData, any>[],
		private dataSource: IDataSource<TInput, T>,
		options: IDataTreeOptions<T, TFilterData> = {}
	) {
		super(user, container, delegate, renderers, options as IDataTreeOptions<T | null, TFilterData>);
		this.identityProvider = options.identityProvider;
	}

	protected createModel(user: string, options: IDataTreeOptions<T, TFilterData>): ITreeModel<T | null, TFilterData, T | null> {
		return new ObjectTreeModel(user, options);
	}
}
