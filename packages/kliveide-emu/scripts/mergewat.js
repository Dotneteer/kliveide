const path = require("path");
const fs = require("fs");

// --- Extract the project build file
const projectFile = process.argv[2];
const symbols = process.argv.slice(3);

mergeWatFile(projectFile, symbols)

/**
 * Merges the files described in the specified project file
 * @param filename Relative path to the project file
 */
function mergeWatFile(filename, symbols) {
  const projectFile = path.join(__dirname, filename);
  console.log(`Processing ${projectFile}`);

  // --- Load project file
  const projectContents = fs.readFileSync(projectFile, "utf8");
  const project = JSON.parse(projectContents);

  // --- Get project properties
  const sourceDir = project.sourceDir;
  const outFilename = path.join(__dirname, project.outFile);

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
  fs.writeFileSync(outFilename, mergedContents);
  console.log(`Merged file written to ${outFilename}`)
}

// --- Collect constant values from comments
function collectConstants(source) {
  const commentRegExp = /(\.)*(;;)\s*(\$[0-9a-zA-Z_]+#)\s*=\s*((0x)?([0-9a-fA-F_]+))(\.*)/g;
  const pairs = {};
  let matchInfo;
  while ((matchInfo = commentRegExp.exec(source)) !== null) {
    const value = matchInfo[5]
      ? parseInt(matchInfo[6].replace("_", ""), 16)
      : parseInt(matchInfo[6].replace("_", ""));
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
