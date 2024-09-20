
import { CancellationToken } from './cancellation.js';

/**
 * A PagedModel is a stateful model over an abstracted paged collection.
 */
export interface IPagedModel<T> {
	length: number;
	isResolved(index: number): boolean;
	get(index: number): T;
	resolve(index: number, cancellationToken: CancellationToken): Promise<T>;
}
