"use strict";

const fs = require("fs");
const { spawn } = require('child_process');
const path = process.argv[2];

if (!path){
    console.error("Error: Please provide a Path")
    console.error("Usage: node scan.js <Folder Path>")
    process.exit(2);
} 

if (!fs.existsSync(path)){
    console.error(`The path specified ${path} is not a valid Path`)
    process.exit(2);
}

if (!fs.statSync(path).isDirectory()) {
  console.error(`Error: '${path}' is a file, but Semgrep needs a folder.`);
  process.exit(2);
}
let rawOutput = '';

const scanner = spawn('semgrep', ['scan', path, '--json', '--config', 'p/nodejs', '--metrics', 'off']);
scanner.stdin.end()
scanner.stdout.on('data', (data)=>{
    rawOutput += data.toString();

})

scanner.stderr.on('data', (data) => {
  console.error(`Semgrep: ${data}`);
});

scanner.on('close', (code) => {
    if (code !== 0) {
        console.error(`Semgrep failed with exit code ${code}`);
        process.exit(2);
    }

    try {
        const parsedData = JSON.parse(rawOutput);

        const results = parsedData.results || []
        const summary = {};
        console.log(`Complete, Found ${results.length} issues`)
        results.forEach(finding => {
            const filePath = finding.path;
            const line = finding.start.line;
            const ruleId = finding.check_id;
            const severity = finding.extra ? finding.extra.severity : 'UNKNOWN'; 
            const message = finding.extra ? finding.extra.message : '';
            
            console.log(`- [${severity}] ${filePath}:${line} ${ruleId}`);
            console.log(`    ${message}`);

            if (summary[severity]) {
                summary[severity]++;
            } else {
                summary[severity] = 1; 
            }
        });

        console.log('\n--- Severity Summary ---');
        console.log(summary);
        if (results.length > 0) {
                console.log("\nExiting with code 1 because vulnerabilities were found.");
                process.exit(1);
            } else {
                console.log("\nGreat job! No vulnerabilities found.");
                process.exit(0);
        }

    } catch (error){
        console.error("Unexpected Error")
        console.error(error.message);
        process.exit(2)
    }

});
scanner.on('error', (error) => {
  if (error.code === 'ENOENT') {
    console.error("Error: Semgrep isn't installed or isn't on your PATH.");
    console.error("Please install it (e.g., using 'pipx install semgrep' or 'brew install semgrep').");
  } else {
    console.error("Error: Failed to start the Semgrep process.");
    console.error(error.message);
  }
  
  process.exit(2);
});