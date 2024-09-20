import monaco from "./monaco";
const app = document.querySelector("#app") as HTMLElement;
const editor = monaco.editor.create(app, {
    value: `console.log("hello,world")`,
    language: "javascript",
});
console.log(monaco)