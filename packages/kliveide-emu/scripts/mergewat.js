const path = require("path");
const fs = require("fs");

const PROJECT_FILE = path.join(__dirname, "wat.json");

// --- Load project file
const projectContents = fs.readFileSync(PROJECT_FILE, "utf8");
const project = JSON.parse(projectContents);

// --- Get project properties
const sourceDir = project.sourceDir;
const outFileName = path.join(__dirname, project.outFile);

// --- Merge the associated files
let mergedContents = "(module \r\n";
for (const file of project.files) {
  const filename = path.join(__dirname, sourceDir, file);
  mergedContents += fs.readFileSync(filename, "utf8") + "\r\n";
}
mergedContents += "\r\n)\r\n";

const constantDefs = collectConstants(mergedContents);
mergedContents = replaceConstants(mergedContents, constantDefs);

// --- Write output
fs.writeFileSync(outFileName, mergedContents);

// --- Collect constant values from comments
function collectConstants(source) {
  const commentRegExp = /(\.)*(;;)\s*(\$[0-9a-zA-Z_]+#)\s*=\s*((0x)?([0-9a-fA-F]+))(\.*)/g;
  const pairs = {};
  let matchInfo;
  while ((matchInfo = commentRegExp.exec(source)) !== null) {
    const value = matchInfo[5]
      ? parseInt(matchInfo[6], 16)
      : parseInt(matchInfo[6]);
    pairs[matchInfo[3].toString()] = value;
  }
  return pairs;
}

// --- Replaces the specified contant values in the source code
function replaceConstants(toReplace, constants) {
  const placeholderRegExp = /(?<!;;\s*)(\$[0-9a-zA-Z_]+#)/g;
  while (true) {
    matchInfo = placeholderRegExp.exec(toReplace);
    if (matchInfo === null) {
      break;
    }
    const key = matchInfo[1];
    const value = constants[key];
    if (value !== undefined) {
      toReplace =
        toReplace.substr(0, matchInfo.index) +
        value +
        toReplace.substr(matchInfo.index + key.length);
    }
  }
  return toReplace;
}
