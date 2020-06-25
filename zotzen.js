const ArgumentParser = require('argparse').ArgumentParser;
const childProcess = require('child_process');
const fs = require('fs');
const opn = require('opn');
const path = require('path');
const prompt = require('prompt');
const getPrompt = require('util').promisify(prompt.get).bind(prompt);

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
parser.addArgument('zot', {
  help: 'Zotero id of the item group_id:item_key or item_key',
  nargs: '?',
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
parser.addArgument('--zen', {
  help: 'Zenodo record id of the item to be linked.',
});
parser.addArgument('--sync', {
  action: 'storeTrue',
  help: 'Sync metadata from zotero to zenodo.',
});
parser.addArgument('--push', {
  action: 'storeTrue',
  help: 'Push Zotero attachments to Zenodo.',
});
parser.addArgument('--type', {
  action: 'store',
  help: 'Type of the attachments to be pushed.',
  defaultValue: 'pdf',
});
parser.addArgument('--publish', {
  action: 'storeTrue',
  help: 'Publish zenodo record.',
});
parser.addArgument('--install', {
  action: 'storeTrue',
  help: 'Install the config for Zotero and Zenodo.',
});
parser.addArgument('--debug', {
  action: 'storeTrue',
  help: 'Enable debug logging',
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

function zenodoCreate(title, zoteroSelectLink, template) {
  template = template || zenodoCreateRecordTemplatePath;
  const zenodoTemplate = JSON.parse(fs.readFileSync(template).toString());
  zenodoTemplate.related_identifiers[0].identifier = zoteroSelectLink;
  if (!zenodoTemplate.title) zenodoTemplate.title = title;
  if (!zenodoTemplate.description) zenodoTemplate.description = title;
  return runCommandWithJsonFileInput('create --show', zenodoTemplate, false);
}

function linkZotZen(zoteroKey, zenodoDoi, group, zoteroLink = null) {
  runCommandWithJsonFileInput(
    `${group ? '--group-id ' + group : ''} update-item --key ${zoteroKey}`,
    {
      extra: `DOI: ${zenodoDoi}`,
    }
  );

  if (zoteroLink) {
    runCommand(`update ${zenodoDoi} --zotero-link ${zoteroLink}`, false);
  }
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
    doi: parseFromZenodoResponse(zenodoResponse, 'DOI'),
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

function syncErrors(doi, zenodoRawItem, zoteroSelectLink) {
  let error = false;
  if (!doi) {
    console.log(
      'This item has no Zenodo DOI. You need to generate or link one first with --getdoi.'
    );
    error = true;
  } else if (!zenodoRawItem) {
    console.log(`Zenodo item with id ${doi} does not exist.`);
    error = true;
  } else if (
    zenodoRawItem.related_identifiers &&
    zenodoRawItem.related_identifiers.length >= 1 &&
    zenodoRawItem.related_identifiers[0].identifier !== zoteroSelectLink
  ) {
    console.log(zoteroSelectLink);
    console.log(
      `The Zenodo item exists, but is not linked. You need to link the items with --zen ${doi} first.`
    );
    error = true;
  }
  return error;
}

function pushAttachment(key, fileName, doi, groupId) {
  console.log(`Pushing from Zotero to Zenodo: ${fileName}`);
  runCommand(
    `${
      groupId ? '--group-id ' + groupId : ''
    } attachment --key ${key} --save "../${fileName}"`
  );
  // TODO: What is the above command fails?
  // TODO: Also, I've inserted "..." in case the filename contains spaces. However, really the filename should be made shell-proof.
  // In perl, you would say:
  //                           use String::ShellQuote; $safefilename = shell_quote($filename);
  // There's no built-in for escaping. We can only escape special characters. We can do that if needed.
  // All the command failures will throw an exception which will be caught on the top-level and a message will be printed.
  runCommand(`upload ${doi} "../${fileName}"`, false);
  // TODO: How does the user know this was successful?
  console.log('Upload successfull.'); //This shoukd be good enough. User can always use --show or --open to see/open the record.
}

function linked(zenodoItem, zoteroLink) {
  return (
    zenodoItem.related_identifiers &&
    zenodoItem.related_identifiers.length >= 1 &&
    zenodoItem.related_identifiers[0].identifier === zoteroLink
  );
}

async function zotzenGet(args) {
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

  let zenodoRawItem = doi && zenodoGetRaw(doi);
  if (args.getdoi) {
    if (doi) {
      console.log(`Item has DOI already: ${doi}`);
      console.log(
        `Linked zotero record: `,
        zenodoRawItem.related_identifiers[0].identifier
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
  } else if (args.zen) {
    try {
      zenodoZenItem = zenodoGetRaw(args.zen);
    } catch (ex) {}
    if (doi) {
      console.log(`Item has DOI already: ${doi}`);
      console.log(
        `Linked zotero record: `,
        zenodoRawItem.related_identifiers[0].identifier
      );
    } else if (!zenodoZenItem) {
      console.log(`Zenodo item with id ${args.zen} does not exist.`);
    } else if (!linked(zenodoZenItem, zoteroSelectLink)) {
      console.log(
        'Zenodo item is linked to a different Zotero item: ',
        zenodoZenItem.related_identifiers[0].identifier
      );
    } else {
      const zenodoLinked = zenodoGet(args.zen);
      doi = zenodoLinked.doi;
      linkZotZen(itemKey, doi, groupId, zoteroSelectLink);
      console.log(`DOI allocated: ${doi}`);
    }
  } else if (doi) {
    if (linked(zenodoRawItem, zoteroSelectLink)) {
      console.log('Item is already linked.');
    } else {
      const result = await getPrompt({
        properties: {
          Link: {
            message: `Found doi: ${doi} not linked to zotero. Proceed? (y/N)`,
            default: 'y',
          },
        },
      });
      if (result && (result.Link == 'y' || result.Link == 'Y')) {
        console.log('Proceeding to link...');
        linkZotZen(itemKey, doi, groupId, zoteroSelectLink);
      }
    }
  }

  let zenodoItem = null;
  if (doi) {
    zenodoItem = zenodoGet(doi);
    zenodoRawItem = zenodoGetRaw(doi);
  }

  if (!zoteroItem.data.title) {
    console.log('Zotero item does not have title. Exiting...');
    return;
  }
  if (
    !zoteroItem.data.abstractNote ||
    zoteroItem.data.abstractNote.length < 3
  ) {
    console.log('Zotero item abstract is less than 3 characters. Exiting...');
    return;
  }
  if (!zoteroItem.data.creators.length) {
    console.log('Zotero item does not have creators. Exiting...');
    return;
  }
  if (args.sync) {
    if (!syncErrors(doi, zenodoRawItem, zoteroSelectLink)) {
      runCommandWithJsonFileInput(
        `update ${doi} --json `,
        {
          title: zoteroItem.data.title,
          description:
            zoteroItem.data.abstractNote +
            (zoteroItem.data.url ? `\n\nAlso see: ${zoteroItem.data.url}` : ''),
          publication_date: zoteroItem.data.date,
          creators: zoteroItem.data.creators.map((c) => {
            return { name: `${c.lastName}, ${c.firstName}` };
          }),
        },
        false
      );
    }
  }

  if (args.push) {
    if (!syncErrors(doi, zenodoRawItem, zoteroSelectLink)) {
      const children = JSON.parse(
        runCommand(
          `${
            groupId ? '--group-id ' + groupId : ''
          } get /items/${itemKey}/children`,
          true
        )
      );
      let attachments = children.filter(
        (c) => c.data.itemType === 'attachment'
      );
      if (args.type !== 'all') {
        attachments = attachments.filter(
          (a) => a.data.contentType === `application/${args.type}`
        );
      }
      attachments.forEach((attachment) => {
        pushAttachment(
          attachment.data.key,
          attachment.data.filename,
          doi,
          groupId
        );
      });
    }
  }

  if (args.show) {
    console.log('Zotero:');
    console.log(`- Item key: ${itemKey}`);
    zoteroItem.data.creators.forEach((c) => {
      console.log(
        '-',
        `${c.creatorType}:`,
        c.name || c.firstName + ' ' + c.lastName
      );
    });
    console.log(`- Date: ${zoteroItem.data.date}`);
    console.log(`- Title: ${zoteroItem.data.title}`);
    console.log(`- DOI: ${doi}`);
    console.log('');

    if (doi) {
      zenodoRawItem = zenodoGetRaw(doi);
      console.log('Zenodo:');
      console.log('* Item available.');
      console.log(`* Item status: ${zenodoItem.status}`);
      console.log(`* Item is ${zenodoItem.writable} writable`);
      console.log(`- Title: ${zenodoRawItem.title}`);
      zenodoRawItem.creators.forEach((c) => {
        console.log(`- Author: ${c.name}`);
      });
      console.log(`- Publication date: ${zenodoRawItem.publication_date}`);
    }
  }

  if (args.publish && doi) {
    runCommand(`get ${doi} --publish`, false);
  }

  if (args.open) {
    opn(zoteroSelectLink);
    if (zenodoItem) {
      opn(zenodoItem.url);
    }
  }
}

try {
  if (args.new) {
    zotzenCreate(args);
  } else if (args.install) {
    const schema = {
      properties: {
        'Zenodo API Key': {
          message: 'Please enter you Zenodo API Key. (Enter to ignore)',
        },
        'Zotero API Key': {
          message: 'Please enter your Zotero API Key. (Enter to ignore)',
        },
        'Zotero User ID': {
          message: 'Please enter your Zotero User ID. (Enter to ignore)',
        },
        'Zotero Group ID': {
          message: 'Please enter your Zotero Group ID. (Enter to ignore)',
        },
      },
    };
    prompt.start();
    prompt.get(schema, (err, result) => {
      if (err) {
        console.err('Invalid input received');
      } else {
        const zenKey = result['Zenodo API Key'];
        if (zenKey) {
          fs.writeFileSync(
            'zenodo-cli/config.json',
            JSON.stringify({
              accessToken: zenKey,
            })
          );
          console.log(
            'Zenodo config wrote successfully to zenodo-cli/config.json.'
          );
        }

        const zotKey = result['Zotero API Key'];
        const zotUid = result['Zotero User ID'];
        const zotGid = result['Zotero Group ID'];
        if (zotKey || zotUid || zotGid) {
          fs.writeFileSync(
            'zotero-cli/zotero-cli.toml',
            `${zotKey ? 'api-key="' + zotKey + '"\n' : ''}` +
              `${zotUid ? 'user-id="' + zotUid + '"\n' : ''}` +
              `${zotGid ? 'group-id="' + zotGid + '"\n' : ''}`
          );
          console.log(
            'Zetoro config wrote successfully to zotero-cli/zotero-cli.toml'
          );
        }
      }
    });
  } else {
    zotzenGet(args);
  }
} catch (ex) {
  if (args.debug) {
    console.log(ex);
  }
}
