require("colors");
const { grey } = require("colors");
const Diff = require("diff");
const fs = require("fs");
const path = require("path");

const html1 = fs.readFileSync("./website/index1.html", "utf-8");
const html2 = fs.readFileSync("./website/index2.html", "utf-8");

const diff = Diff.diffLines(html2, html1);

console.log(diff[3], diff[2])

diff.forEach((part) => {
    console.log({
        ...part,
        value: part.value.length
    })
  //   green for additions, red for deletions
  //   grey for common parts
  const color = part.added ? "green" : part.removed ? "red" : "grey";
//   process.stderr.write(`${part.value[color]} \n`);
});

// console.log();
