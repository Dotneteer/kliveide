const path = require("path");
const fs = require("fs");

copyDir(
  path.join(__dirname, "../templates"),
  path.join(__dirname, "../out/templates")
);
copyDir(
  path.join(__dirname, "../assets"),
  path.join(__dirname, "../out/assets")
);

function copyDir(src, dest) {
  mkdir(dest);
  var files = fs.readdirSync(src);
  for (var i = 0; i < files.length; i++) {
    var current = fs.lstatSync(path.join(src, files[i]));
    if (current.isDirectory()) {
      copyDir(path.join(src, files[i]), path.join(dest, files[i]));
    } else if (current.isSymbolicLink()) {
      var symlink = fs.readlinkSync(path.join(src, files[i]));
      fs.symlinkSync(symlink, path.join(dest, files[i]));
    } else {
      copy(path.join(src, files[i]), path.join(dest, files[i]));
    }
  }
}

function mkdir(dir) {
  // making directory without exception if exists
  try {
    fs.mkdirSync(dir, 0755);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
}

function copy(src, dest) {
  var oldFile = fs.createReadStream(src);
  var newFile = fs.createWriteStream(dest);
  oldFile.pipe(newFile);
}
