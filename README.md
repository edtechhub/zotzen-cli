# zotzen

Requires:
- zenodo-cli from https://github.com/bjohas/Zenodo-tools
- zotero-cli from https://github.com/edtechhub/zotero-cli


## Setup

You need to have config files set up
```
zotero-cli -> zotero-cli.toml
zenodo-cli -> config.json
```

Check whether you can log into both APIs, e.g. by running
```
zenodo-cli list
zotero-cli ???
```

## Use of zotzen

### Check an item
```
zotzen --zot 123:ABC --show
``` 

The Zotero item with item key ABC is fetched (from group 123) and
inspected. Output:
```
Zotero
- Item key: 123:ABC
- Title: ...
- DOI: ...
```

If there is a DOI (either in the DOI field or under
'extra'), and this DOI is a zenodo doi, the zenodo data is fetched. Output continues
```
Zenodo:
- Item available.
- Item status: ...
- Title: ...
- Item is [not] writable.
```

### Generate a DOI for a Zotero item
```
zotzen --zot 123:ABC --getdoi [--template zenodo.json]
``` 
The Zotero item with item key ABC is fetched (from group 123) and
inspected. If there is a DOI, then:

```
Item has DOI already: <DOI>
```

If there isn't a DOI, the item data is put into Zenodo format (basic
use of title, abstract, date and authors only, for now). Additional fields are filled
form the `zenodo.json` if provided. Response:

```
DOI allocated: <DOI>
```

The DOI is written to the Zotero item. I.e., ttach the resulting DOI
to the Zotero record (to the DOI field or to extra if no DOI field).


### Linking a Zotero item to an existing Zenodo item
```
zotzen --zot 123:ABC --zen 567 
``` 
The Zotero item with item key ABC is fetched (from group 123) and
inspected.

If there is
- no DOI
- AND the zenodo item with key 567 exists,
then the items as linked, i.e., the DOI derived from teh zenodo item key 567 is added to the zotero item.


### Sync metadata from zotero to zenodo
```
zotzen --zot 123:ABC --sync
``` 

The zotero item metadata is retrieved (as with `--show`)  and written to Zenodo (as above for `--getdoi`).


### Push Zotero attachments to Zenodo.

```
zotzen --zot 123:ABC --push [--types pdf|all]
```

The attachments to ABC are attached to the record
-- `--type pdf` (default) attached PDF files only. 
-- `--type all` attached all.

### Combinations
The options `--getdoi`, `--sync` and `--push` can be combined.
```
zotzen --zot 123:ABC --getdoi --sync --push
```

or

```
zotzen --zot 123:ABC --zen 456 --sync --push
```

Also, publish the Zenodo record:

```
zotzen [...] --publish
```

Also, open the webpage for the Zenodo record:

```
zotzen [...] --open
```

# Note

This tools doesn't allow you to go from Zenodo to Zotero. You've
already got the browser plugin for Zotero, and you can easily use that
on a Zenodo page. So not much need for this tool to go the other way.

# Also note

Going from Zotero json to Zenodo json is not necessarily straight
forward. We can make some compromises here, such as manually setting
up the Zenodo item (or using zenodo.json) and only syncing the most
common Zotero properties (title, author, abstract, date).


