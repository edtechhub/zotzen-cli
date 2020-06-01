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

const zoteroPrefix = 'node bin/zotero-cli.js';
const zenodoPrefix = 'python zenodo-cli.py';
const zoteroSelectPrefix = 'zotero://select';
const zoteroApiPrefix = 'https://api.zotero.org';
const zoteroTmpFile = 'zotero-cli/tmp';
const zenodoTmpFile = 'zenodo-cli/tmp';
const zenodoCreateRecordTemplatePath = 'zenodo-cli/template.json';

function runCommandWithJsonFileInput(command, json, zotero = true) {
  fs.writeFileSync(
    zotero ? zoteroTmpFile : zenodoTmpFile,
    JSON.stringify(json)
  );
  const response = runCommand(`${command} tmp`, zotero);
  fs.unlinkSync(zotero ? zoteroTmpFile : zenodoTmpFile);
  return response;
}

function runCommand(command, zotero = true) {
  return childProcess
    .execSync(`${zotero ? zoteroPrefix : zenodoPrefix} ${command}`, {
      cwd: `${zotero ? 'zotero' : 'zenodo'}-cli`,
    })
    .toString();
}

function parseFromZenodoResponse(content, key) {
  return content
    .substr(content.indexOf(`${key}:`))
    .split('\n')[0]
    .split(':')
    .slice(1)
    .join(':')
    .trim();
}

function zotzenCreate(title) {
  // Create zotero record
  const zoteroCreateItemTemplate = runCommand(
    'create-item --template report',
    true
  );
  const templateJson = JSON.parse(zoteroCreateItemTemplate);
  templateJson.title = title;
  const newItem = JSON.parse(
    runCommandWithJsonFileInput('create-item', templateJson, true)
  );

  // Create zenodo record
  const zenodoTemplate = JSON.parse(
    fs.readFileSync(zenodoCreateRecordTemplatePath).toString()
  );
  const zoteroSelectLink = newItem.successful[0].links.self.href.replace(
    zoteroApiPrefix,
    zoteroSelectPrefix
  );
  zenodoTemplate.related_identifiers[0].identifier = zoteroSelectLink;
  zenodoTemplate.title = title;
  zenodoTemplate.description = title;
  const zenodoRecord = runCommandWithJsonFileInput(
    'create --show',
    zenodoTemplate,
    false
  );

  const doi = parseFromZenodoResponse(zenodoRecord, 'DOI');
  const zenodoDepositUrl = parseFromZenodoResponse(zenodoRecord, 'URL');
  runCommandWithJsonFileInput(
    `update-item --key ${newItem.successful['0'].key}`,
    {
      extra: doi,
    }
  );

  console.log('Item successfully created: ');
  console.log(
    `Zotero ID: ${newItem.successful[0].library.id}:${newItem.successful[0].key}`
  );
  console.log(`Zotero link: ${newItem.successful[0].links.self.href}`);
  console.log(`Zotero select link: ${zoteroSelectLink}`);
  console.log(
    `Zenodo RecordId: ${parseFromZenodoResponse(zenodoRecord, 'RecordId')}`
  );
  console.log(`Zenodo DOI: ${doi}`);
  console.log(`Zenodo deposit link: ${zenodoDepositUrl}`);
}

if (args.new) {
  if (args.title) {
    zotzenCreate(args.title);
  }
}
