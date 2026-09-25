// 从 CHANGELOG.md 中取出本次发布对应的章节，写入 result.txt 供 GitHub Release 使用
// 用法：node ./scripts/release_note.js   （GITHUB_REF_NAME 缺省时取最上面一个 ### 章节）
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.env.GITHUB_REF_NAME ?? "";

/** 按 `###` 标题切分 CHANGELOG，返回 [{ title, content }] */
function parseSections(text) {
    const heading = /^###[ \t]+(.+?)[ \t]*$/gm;
    const marks = [];
    let match;
    while ((match = heading.exec(text)) !== null) {
        marks.push({ title: match[1], start: match.index, bodyStart: heading.lastIndex });
    }
    return marks.map((mark, i) => {
        const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
        return { title: mark.title, content: text.slice(mark.bodyStart, end).trim() };
    });
}

const sections = parseSections(readFileSync(join(rootDir, "CHANGELOG.md"), "utf-8"));
const hit = tag ? sections.find((s) => s.title === tag || s.title.startsWith(`${tag} `)) : undefined;
const section = hit ?? sections[0];
const note = section ? `${section.title}\n\n${section.content}\n` : "";

writeFileSync(join(rootDir, "result.txt"), note, "utf-8");
console.log(`[release_note] tag=${tag || "(none)"} -> ${section ? section.title : "(empty)"}`);
