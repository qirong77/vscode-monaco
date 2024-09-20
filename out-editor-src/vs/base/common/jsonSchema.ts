/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'array' | 'object';

export interface IJSONSchema {
	type?: JSONSchemaType | JSONSchemaType[];
	default?: any;
	definitions?: IJSONSchemaMap;
	description?: string;
	properties?: IJSONSchemaMap;
	patternProperties?: IJSONSchemaMap;
	additionalProperties?: boolean | IJSONSchema;
	items?: IJSONSchema | IJSONSchema[];
	pattern?: string;
	minimum?: number;
	maximum?: number;
	required?: string[];
	$ref?: string;
	anyOf?: IJSONSchema[];
	oneOf?: IJSONSchema[];
	enum?: any[];
	format?: string;

	// schema draft 06
	const?: any;
	deprecated?: boolean;

	// VSCode extensions

	defaultSnippets?: IJSONSchemaSnippet[];
	errorMessage?: string;
	patternErrorMessage?: string;
	deprecationMessage?: string;
	markdownDeprecationMessage?: string;
	enumDescriptions?: string[];
	markdownEnumDescriptions?: string[];
	markdownDescription?: string;
	allowComments?: boolean;
	allowTrailingCommas?: boolean;
}

export interface IJSONSchemaMap {
	[name: string]: IJSONSchema;
}

export interface IJSONSchemaSnippet {
	body?: any; // an already stringified JSON object that can contain new lines (\n) and tabs (\t)
}

/**
 * Converts a basic JSON schema to a TypeScript type.
 *
 * TODO: only supports basic schemas. Doesn't support all JSON schema features.
 */
export type SchemaToType<T> = T extends { type: 'string' }
	? string
	: T extends { type: 'number' }
	? number
	: T extends { type: 'boolean' }
	? boolean
	: T extends { type: 'null' }
	? null
	: T extends { type: 'object'; properties: infer P }
	? { [K in keyof P]: SchemaToType<P[K]> }
	: T extends { type: 'array'; items: infer I }
	? Array<SchemaToType<I>>
	: never;

