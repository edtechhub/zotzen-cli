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
parser.addArgument('--group', {
  help: 'Group ID for which the new item is to be created.',
});
parser.addArgument('--zot', {
  help: 'Zotero id of the item group_id:item_key or item_key',
});
parser.addArgument('--show', {
  action: 'storeTrue',
  help: 'Show the zotero, zenodo item information.',
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

function zoteroCreate(title, group, jsonFile = null) {
  if (jsonFile) {
    return JSON.parse(
      runCommand(
        `${group ? '--group-id ' + group : ''} create-item ${path.join(
          __dirname,
          jsonFile
        )}`,
        true
      )
    );
  }

  const zoteroCreateItemTemplate = runCommand(
    'create-item --template report',
    true
  );
  const templateJson = JSON.parse(zoteroCreateItemTemplate);
  templateJson.title = title;
  return JSON.parse(
    runCommandWithJsonFileInput(
      `${group ? '--group-id ' + group : ''} create-item`,
      templateJson,
      true
    )
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
  const zoteroRecord = zoteroCreate(args.title, args.group, args.json);
  const zoteroSelectLink = zoteroRecord.successful[0].links.self.href.replace(
    zoteroApiPrefix,
    zoteroSelectPrefix
  );

  const zenodoRecord = zenodoCreate(zoteroRecord, zoteroSelectLink);
  const doi = parseFromZenodoResponse(zenodoRecord, 'DOI');
  const zenodoDepositUrl = parseFromZenodoResponse(zenodoRecord, 'URL');

  runCommandWithJsonFileInput(
    `${args.group ? '--group-id ' + args.group : ''} update-item --key ${
      zoteroRecord.successful['0'].key
    }`,
    {
      extra: `DOI: ${doi}`,
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

function zoteroGet(groupId, itemKey) {
  return JSON.parse(
    runCommand(
      `${groupId ? '--group-id ' + groupId : ''} item --key ${itemKey}`,
      true
    )
  );
}

function zenodoGet(doi) {
  const zenodoResposne = runCommand(`get ${doi} --show`, false);
  return {
    title: parseFromZenodoResponse(zenodoResposne, 'Title'),
    status: parseFromZenodoResponse(zenodoResposne, 'State'),
    writable:
      parseFromZenodoResponse(zenodoResposne, 'Published') == 'yes'
        ? 'not'
        : '',
  };
}

function zotzenGet(args) {
  let groupId = null;
  let itemKey = null;
  if (args.zot.includes(':')) {
    groupId = args.zot.split(':')[0];
    itemKey = args.zot.split(':')[1];
  } else {
    itemKey = args.zot;
  }

  const zoteroItem = zoteroGet(groupId, itemKey);
  const doi =
    zoteroItem.data.extra &&
    zoteroItem.data.extra.split(':').slice(1).join(':').trim();

  if (args.show) {
    console.log(`- Item key: ${args.zot}`);
    console.log(`- Title: ${zoteroItem.data.title}`);
    console.log(`- DOI: ${doi}`);

    if (doi) {
      const zenodoItem = zenodoGet(doi);
      console.log('- Item available.');
      console.log(`- Item status: ${zenodoItem.status}`);
      console.log(`- Title: ${zenodoItem.title}`);
      console.log(`- Item is ${zenodoItem.writable} writable`);
    }
  }
}

if (args.new) {
  zotzenCreate(args);
} else if (args.zot) {
  zotzenGet(args);
}
