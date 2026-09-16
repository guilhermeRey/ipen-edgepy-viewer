import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, "software-metrics.config.json"), "utf8"));
const checkMode = process.argv.includes("--check");
const jsonMode = process.argv.includes("--json");

const files = collectSourceFiles(config.include.map((entry) => path.join(root, entry)));
const fileMetrics = files.map(analyzeFile);
const functions = fileMetrics.flatMap((file) => file.functions);
const violations = collectViolations(fileMetrics, functions, config.thresholds);
const maxCyclomaticComplexity = max(functions.map((item) => item.cyclomaticComplexity));
const maxFunctionLines = max(functions.map((item) => item.lines));
const maxFileLines = max(fileMetrics.map((file) => file.loc));

const report = {
  checkedFiles: fileMetrics.length,
  totalLoc: sum(fileMetrics.map((file) => file.loc)),
  totalFunctions: functions.length,
  maxCyclomaticComplexity,
  maxFunctionLines,
  maxFileLines,
  comparison: {
    cyclomaticComplexity: comparisonLabel(maxCyclomaticComplexity, config.comparisonBands.cyclomaticComplexity),
    functionLines: comparisonLabel(maxFunctionLines, config.comparisonBands.functionLines),
    fileLines: comparisonLabel(maxFileLines, config.comparisonBands.fileLines),
  },
  topComplexFunctions: [...functions]
    .sort((left, right) => right.cyclomaticComplexity - left.cyclomaticComplexity || right.lines - left.lines)
    .slice(0, 10),
  largestFiles: [...fileMetrics]
    .sort((left, right) => right.loc - left.loc)
    .slice(0, 10)
    .map(({ file, loc }) => ({ file, loc })),
  thresholds: config.thresholds,
  comparisonBands: config.comparisonBands,
  violations,
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

if (checkMode && violations.length > 0) {
  process.exitCode = 1;
}

function collectSourceFiles(directories) {
  return directories.flatMap(walk).filter((file) => {
    const relative = relativePath(file);
    return (
      [".ts", ".tsx"].includes(path.extname(file)) &&
      !config.exclude.some((segment) => relative.split(path.sep).includes(segment)) &&
      !config.excludeFiles.some((suffix) => relative.endsWith(suffix))
    );
  });
}

function walk(entry) {
  if (!fs.existsSync(entry)) {
    return [];
  }
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    return [entry];
  }
  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((item) => walk(path.join(entry, item.name)));
}

function analyzeFile(file) {
  const sourceText = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const functions = [];

  visit(sourceFile, (node) => {
    if (!isFunctionLikeWithBody(node)) {
      return;
    }
    functions.push(analyzeFunction(sourceFile, node));
  });

  return {
    file: relativePath(file),
    loc: sourceText.split("\n").filter((line) => line.trim().length > 0).length,
    functions,
  };
}

function analyzeFunction(sourceFile, node) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    file: relativePath(sourceFile.fileName),
    name: functionName(node),
    line: start.line + 1,
    lines: end.line - start.line + 1,
    cyclomaticComplexity: cyclomaticComplexity(node),
  };
}

function cyclomaticComplexity(functionNode) {
  let complexity = 1;
  visit(functionNode.body, (node) => {
    if (node !== functionNode.body && isFunctionLikeWithBody(node)) {
      return false;
    }
    if (isDecisionNode(node)) {
      complexity += 1;
    }
    if (ts.isBinaryExpression(node) && isLogicalOperator(node.operatorToken.kind)) {
      complexity += 1;
    }
    return true;
  });
  return complexity;
}

function visit(node, callback) {
  const result = callback(node);
  if (result === false) {
    return;
  }
  ts.forEachChild(node, (child) => visit(child, callback));
}

function isDecisionNode(node) {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isCaseClause(node) ||
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node)
  );
}

function isLogicalOperator(kind) {
  return kind === ts.SyntaxKind.AmpersandAmpersandToken || kind === ts.SyntaxKind.BarBarToken;
}

function isFunctionLikeWithBody(node) {
  return (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node)) &&
    Boolean(node.body)
  );
}

function functionName(node) {
  if (node.name?.text) {
    return node.name.text;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
  }
  return "<anonymous>";
}

function collectViolations(fileMetrics, functions, thresholds) {
  return [
    ...functions
      .filter((item) => item.cyclomaticComplexity > thresholds.maxCyclomaticComplexity)
      .map((item) => ({
        kind: "function-complexity",
        message: `${item.file}:${item.line} ${item.name} complexity ${item.cyclomaticComplexity} > ${thresholds.maxCyclomaticComplexity}`,
      })),
    ...functions
      .filter((item) => item.lines > thresholds.maxFunctionLines)
      .map((item) => ({
        kind: "function-lines",
        message: `${item.file}:${item.line} ${item.name} lines ${item.lines} > ${thresholds.maxFunctionLines}`,
      })),
    ...fileMetrics
      .filter((item) => item.loc > thresholds.maxFileLines)
      .map((item) => ({
        kind: "file-lines",
        message: `${item.file} LOC ${item.loc} > ${thresholds.maxFileLines}`,
      })),
  ];
}

function printHumanReport(report) {
  console.log(`Software metrics for edgepy-viewer`);
  console.log(`Files: ${report.checkedFiles}`);
  console.log(`LOC: ${report.totalLoc}`);
  console.log(`Functions: ${report.totalFunctions}`);
  console.log(`Max cyclomatic complexity: ${report.maxCyclomaticComplexity} (${report.comparison.cyclomaticComplexity})`);
  console.log(`Max function lines: ${report.maxFunctionLines} (${report.comparison.functionLines})`);
  console.log(`Max file lines: ${report.maxFileLines} (${report.comparison.fileLines})`);
  console.log("");
  console.log("Top complex functions:");
  for (const item of report.topComplexFunctions) {
    console.log(`- ${item.file}:${item.line} ${item.name}: complexity ${item.cyclomaticComplexity}, ${item.lines} lines`);
  }
  console.log("");
  console.log("Largest files:");
  for (const item of report.largestFiles) {
    console.log(`- ${item.file}: ${item.loc} LOC`);
  }
  console.log("");
  if (report.violations.length === 0) {
    console.log("Thresholds: passed");
    return;
  }
  console.log("Threshold violations:");
  for (const violation of report.violations) {
    console.log(`- ${violation.message}`);
  }
}

function relativePath(file) {
  return path.relative(root, file);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function max(values) {
  return values.length === 0 ? 0 : Math.max(...values);
}

function comparisonLabel(value, bands) {
  const match = bands.find((band) => band.max === null || value <= band.max);
  return match?.label ?? "unclassified";
}
