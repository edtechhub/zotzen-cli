const ArgumentParser = require('argparse').ArgumentParser;
const childProcess = require('child_process');
const fs = require('fs');
const opn = require('opn');
const path = require('path');

const parser = new ArgumentParser({
  version: '1.0.0',
  addHelp: true,
  description: 'Zotzen utility',
});

parser.addArgument('--new', {
  action: 'storeTrue',
  help: 'Create a new document.',
});
parser.addArgument('--title', { help: 'Title of the new document.' });
parser.addArgument('--json', {
  help: 'Path of the json for the new document.',
});
parser.addArgument('--open', {
  action: 'storeTrue',
  help: 'Open the zotero and zenodo link after creation.',
});

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

function zoteroCreate(title, jsonFile = null) {
  if (jsonFile) {
    return JSON.parse(
      runCommand(`create-item ${path.join(__dirname, jsonFile)}`, true)
    );
  }

  const zoteroCreateItemTemplate = runCommand(
    'create-item --template report',
    true
  );
  const templateJson = JSON.parse(zoteroCreateItemTemplate);
  templateJson.title = title;
  return JSON.parse(
    runCommandWithJsonFileInput('create-item', templateJson, true)
  );
}

function zenodoCreate(zoteroRecord, zoteroSelectLink) {
  const zenodoTemplate = JSON.parse(
    fs.readFileSync(zenodoCreateRecordTemplatePath).toString()
  );
  zenodoTemplate.related_identifiers[0].identifier = zoteroSelectLink;
  zenodoTemplate.title = zoteroRecord.successful[0].data.title;
  zenodoTemplate.description = zoteroRecord.successful[0].data.title;
  return runCommandWithJsonFileInput('create --show', zenodoTemplate, false);
}

function zotzenCreate(args) {
  const zoteroRecord = zoteroCreate(args.title, args.json);
  const zoteroSelectLink = zoteroRecord.successful[0].links.self.href.replace(
    zoteroApiPrefix,
    zoteroSelectPrefix
  );

  const zenodoRecord = zenodoCreate(zoteroRecord, zoteroSelectLink);
  const doi = parseFromZenodoResponse(zenodoRecord, 'DOI');
  const zenodoDepositUrl = parseFromZenodoResponse(zenodoRecord, 'URL');

  runCommandWithJsonFileInput(
    `update-item --key ${zoteroRecord.successful['0'].key}`,
    {
      extra: doi,
    }
  );

  console.log('Item successfully created: ');
  console.log(
    `Zotero ID: ${zoteroRecord.successful[0].library.id}:${zoteroRecord.successful[0].key}`
  );
  console.log(`Zotero link: ${zoteroRecord.successful[0].links.self.href}`);
  console.log(`Zotero select link: ${zoteroSelectLink}`);
  console.log(
    `Zenodo RecordId: ${parseFromZenodoResponse(zenodoRecord, 'RecordId')}`
  );
  console.log(`Zenodo DOI: ${doi}`);
  console.log(`Zenodo deposit link: ${zenodoDepositUrl}`);

  if (args.open) {
    opn(zoteroSelectLink);
    opn(zenodoDepositUrl);
  }
}

if (args.new) {
  zotzenCreate(args);
}
