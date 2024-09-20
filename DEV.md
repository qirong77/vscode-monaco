# Change Build Version(How It Works)

## 1. build from vscode
1. nvm use 20
2. npm i 
3. npm run editor-esm => get `out-editor-src` and `out-monaco-editor-core`
4. copy `out-editor-src` to the root dir (make sure tsconfig is included in `out-editor-src`)

## 2. in the repo
1. change `hideUnchangedRegionsFeature.ts` to `hideUnchangedRegionsFeature.js` which from `out-monaco-editor-core` above.
2. npm run dev

## TODO
[] language support
