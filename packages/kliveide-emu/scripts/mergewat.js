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

// --- Write output
fs.writeFileSync(outFileName, mergedContents);
