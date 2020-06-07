const ArgumentParser = require('argparse').ArgumentParser;
const childProcess = require('child_process');
const fs = require('fs');
const opn = require('opn');
const path = require('path');

const parser = new ArgumentParser({
  version: '1.0.0',
  addHelp: true,
  description: 'Zotzen utility. Main modes are --new or --zot.',
});

parser.addArgument('--new', {
  action: 'storeTrue',
  help: 'Create a new pair of Zotero/Zenodo entries.',
});
parser.addArgument('--title', {
  help: 'Title of the new entries (for --new).',
});
parser.addArgument('--json', {
  help: 'A Zotero json file to be used for the Zotero entry (for --new).',
});
parser.addArgument('--group', {
  help: 'Group ID for which the new item Zotero is to be created (for --new).',
});
parser.addArgument('--zot', {
  help: 'Zotero id of the item group_id:item_key or item_key',
});
parser.addArgument('--show', {
  action: 'storeTrue',
  help: 'Show the zotero, zenodo item information (for both --new and --zot).',
});
parser.addArgument('--open', {
  action: 'storeTrue',
  help:
    'Open the zotero and zenodo link after creation (for both --new and --zot).',
});
parser.addArgument('--getdoi', {
  action: 'storeTrue',
  help: 'Generate a DOI for an existing Zotero item.',
});
parser.addArgument('--template', {
  help: 'Path of the template to be used for creating Zenodo record.',
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
  try {
    return childProcess
      .execSync(`${zotero ? zoteroPrefix : zenodoPrefix} ${command}`, {
        cwd: `${zotero ? 'zotero' : 'zenodo'}-cli`,
      })
      .toString();
  } catch (ex) {
    throw new Error(`${zotero ? 'Zotero' : 'Zenodo'}: ${ex.output.toString()}`);
  }
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

function zenodoCreate(
  title,
  zoteroSelectLink,
  template = zenodoCreateRecordTemplatePath
) {
  const zenodoTemplate = JSON.parse(fs.readFileSync(template).toString());
  zenodoTemplate.related_identifiers[0].identifier = zoteroSelectLink;
  if (!zenodoTemplate.title) zenodoTemplate.title = title;
  if (!zenodoTemplate.description) zenodoTemplate.description = title;
  return runCommandWithJsonFileInput('create --show', zenodoTemplate, false);
}

function linkZotZen(zoteroKey, zenodoDoi, group) {
  runCommandWithJsonFileInput(
    `${group ? '--group-id ' + group : ''} update-item --key ${zoteroKey}`,
    {
      extra: `DOI: ${zenodoDoi}`,
    }
  );
}

function zotzenCreate(args) {
  const zoteroRecord = zoteroCreate(args.title, args.group, args.json);
  const zoteroSelectLink = zoteroRecord.successful[0].links.self.href.replace(
    zoteroApiPrefix,
    zoteroSelectPrefix
  );

  const zenodoRecord = zenodoCreate(
    zoteroRecord.successful[0].data.title,
    zoteroSelectLink
  );
  const doi = parseFromZenodoResponse(zenodoRecord, 'DOI');
  const zenodoDepositUrl = parseFromZenodoResponse(zenodoRecord, 'URL');

  linkZotZen(zoteroRecord.successful[0].key, doi, args.group);

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

function zoteroGet(groupId, userId, itemKey) {
  return JSON.parse(
    runCommand(
      `${groupId ? '--group-id ' + groupId : ''} ${
        userId ? '--user-id ' + userId : ''
      } item --key ${itemKey}`,
      true
    )
  );
}

function zenodoGet(doi) {
  const zenodoResponse = runCommand(`get ${doi} --show`, false);
  return {
    title: parseFromZenodoResponse(zenodoResponse, 'Title'),
    status: parseFromZenodoResponse(zenodoResponse, 'State'),
    writable:
      parseFromZenodoResponse(zenodoResponse, 'Published') == 'yes'
        ? 'not'
        : '',
    url: parseFromZenodoResponse(zenodoResponse, 'URL'),
  };
}

function zenodoGetRaw(doi) {
  runCommand(`get ${doi}`, false);
  const fileName = doi.split('.').pop();
  return JSON.parse(fs.readFileSync(`zenodo-cli/${fileName}.json`).toString());
}

function getZoteroSelectlink(id, key, group = false) {
  return `zotero://select/${group ? 'groups' : 'users'}/${id}/items/${key}`;
}

function zotzenGet(args) {
  let groupId = null;
  let itemKey = null;
  let userId = null;
  if (args.zot.includes('zotero')) {
    const selectLink = args.zot.split('/');
    if (selectLink.length < 7) {
      throw new Error('Invalid zotero select link specified');
    }
    if (selectLink[3] == 'users') {
      userId = selectLink[4];
    } else {
      groupId = selectLink[4];
    }
    itemKey = selectLink[6];
  } else if (args.zot.includes(':')) {
    groupId = args.zot.split(':')[0];
    itemKey = args.zot.split(':')[1];
  } else {
    itemKey = args.zot;
  }

  const zoteroItem = zoteroGet(groupId, userId, itemKey);
  let doi = null;
  const doiRegex = new RegExp(/10\.5281\/zenodo\.[0-9]+/);
  if (zoteroItem.data.extra) {
    const match = zoteroItem.data.extra.match(doiRegex);
    if (match) {
      doi = match[0];
    }
  }
  const zoteroSelectLink = getZoteroSelectlink(
    groupId || userId,
    itemKey,
    !!groupId
  );

  if (args.getdoi) {
    if (doi) {
      const zenodoItem = zenodoGetRaw(doi);
      console.log(`Item has DOI already: ${doi}`);
      console.log(
        `Linked zotero record: `,
        zenodoItem.related_identifiers[0].identifier
      );
    } else {
      const zenodoRecord = zenodoCreate(
        zoteroItem.data.title,
        zoteroSelectLink,
        args.template
      );
      doi = parseFromZenodoResponse(zenodoRecord, 'DOI');
      linkZotZen(itemKey, doi, groupId);
      console.log(`DOI allocated: ${doi}`);
    }
  }

  let zenodoItem = null;
  if (doi) {
    zenodoItem = zenodoGet(doi);
  }

  if (args.show) {
    console.log('Zotero:');
    console.log(`- Item key: ${itemKey}`);
    console.log(`- Title: ${zoteroItem.data.title}`);
    console.log(`- DOI: ${doi}`);
    console.log('');

    if (doi) {
      console.log('Zenodo:');
      console.log('- Item available.');
      console.log(`- Item status: ${zenodoItem.status}`);
      console.log(`- Title: ${zenodoItem.title}`);
      console.log(`- Item is ${zenodoItem.writable} writable`);
    }
  }

  if (args.open) {
    opn(zoteroSelectLink);
    opn(zenodoItem.url);
  }
}

try {
  if (args.new) {
    zotzenCreate(args);
  } else if (args.zot) {
    zotzenGet(args);
  }
} catch (ex) {
  console.log('Error: ');
  console.log(ex.message);
}
