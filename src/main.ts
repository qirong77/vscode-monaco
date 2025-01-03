import monaco from "./monaco";
const app = document.querySelector("#app") as HTMLElement;
const editor = monaco.editor.create(app, {
    value: `TypeScript 5.4 正式发布，新增功能包括 JS 新方法、保留闭包收窄范围、NoInfer工具类型、支持特定模块中的require()调用、检查导入属性和断言、添加缺失参数快速修复、子路径导入自动支持等，同时也有即将废弃的功能和显著的行为变化`,
    language: "javascript",
});
console.log(monaco)