
import { Registry } from '../../registry/common/platform.js';

export interface FileAdditionalNativeProperties {
	/**
	 * The real path to the file on the users filesystem. Only available on electron.
	 */
	readonly path?: string;
}


//#region Editor / Resources DND

export const CodeDataTransfers = {
	EDITORS: 'CodeEditors',
	FILES: 'CodeFiles'
};

export interface IDragAndDropContributionRegistry {
}

class DragAndDropContributionRegistry implements IDragAndDropContributionRegistry {
}

export const Extensions = {
	DragAndDropContribution: 'workbench.contributions.dragAndDrop'
};

Registry.add(Extensions.DragAndDropContribution, new DragAndDropContributionRegistry());

//#endregion

//#region DND Utilities

/**
 * A singleton to store transfer data during drag & drop operations that are only valid within the application.
 */
export class LocalSelectionTransfer<T> {

	private static readonly INSTANCE = new LocalSelectionTransfer();

	private data?: T[];
	private proto?: T;

	private constructor() {
		// protect against external instantiation
	}

	static getInstance<T>(): LocalSelectionTransfer<T> {
		return LocalSelectionTransfer.INSTANCE as LocalSelectionTransfer<T>;
	}

	hasData(proto: T): boolean {
		return proto && proto === this.proto;
	}

	getData(proto: T): T[] | undefined {
		if (this.hasData(proto)) {
			return this.data;
		}

		return undefined;
	}
}

//#endregion
