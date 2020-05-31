const ArgumentParser = require('argparse').ArgumentParser;
const childProcess = require('child_process');
const fs = require('fs');

const parser = new ArgumentParser({
  version: '1.0.0',
  addHelp: true,
  description: 'Zotzen utility',
});

parser.addArgument('--new', {
  action: 'storeTrue',
  help: 'Create a new document',
});
parser.addArgument('--title', { help: 'Create a new document' });

const args = parser.parseArgs();

const zoteroPrefix = 'node bin\\zotero-cli.js';

function runZoteroCommand(command) {
  return childProcess
    .execSync(`${zoteroPrefix} ${command}`, { cwd: 'zotero-cli' })
    .toString();
}

if (args.new) {
  if (args.title) {
    const zoteroCreateItemTemplate = runZoteroCommand(
      'create-item --template report'
    );
    const templateJson = JSON.parse(zoteroCreateItemTemplate);
    templateJson.title = args.title;
    fs.writeFileSync('zotero-cli\\tmp', JSON.stringify(templateJson));
    runZoteroCommand(`create-item tmp`);
    fs.unlinkSync('zotero-cli\\tmp');
    console.log('Item successfully created.');
  }
}
