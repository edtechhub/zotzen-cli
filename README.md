# zotzen

A commandline tool to exchange data between Zotero and Zenodo, using the respective APIs. Developed by [@bjohas](https://github.com/bjohas) and [@a1diablo](https://github.com/a1diablo).

Requires:

- zenodo-cli from https://github.com/bjohas/Zenodo-tools
- zotero-cli from https://github.com/edtechhub/zotero-cli

## Setup

After cloning this repository, pull the submodules

```
git submodule update --init --recursive
```

Make sure the dependent modules are built

```
cd zotero-cli
npm install
npm run build
cd ..

cd zenodo-cli
pip install -r requirements.txt
cd ..
```

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

### Create a new item on Zotero and Zenodo

Generate a new item pair:

```
zotzen --new --title "ABC"
```

Generate a new item pair in a specific Zotero group:

```
zotzen --new --group 123 --title "ABC"
```

This operation

- Generates a Zotero item with title "ABC"
- It registers a new record on Zenodo
- Attached the DOI for the record to Zotero.
- It prints out
  -- The Zotero ID: 123:XYZ
  -- The link to the Zotero id: https://...
  -- The Zotero-select link: zotero://...
  -- The Zenodo number: 678
  -- The Zenodo DOI: ..../...678
  -- The desposit link to Zenodo: https://....

If the option

```
--open
```

is specified then the Zenodo page and the Zotero page are opened in the browser.

As an alternative to `--title`, you can specify

```
--json record.json
```

in which case the `record.json` will be used to generate the record on Zotero.

### Check an existing zotero item

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

### Generate a DOI for an existing Zotero item

```
zotzen --zot 123:ABC --getdoi [--template zenodo.json]
```

The Zotero item with item key ABC is fetched (from group 123) and
inspected.

(1) If there is a DOI, then:

```
Item has DOI already: <DOI>
```

If that's a Zenodo DOI, inspect the Zenodo DOI and see whether the reference in the item is back to the same Zotero item. Print the result.

(2) If there isn't a DOI, the item data is put into Zenodo format (basic
use of title, abstract, date and authors only, for now). Additional fields are filled
form the `zenodo.json` if provided. Response:

```
DOI allocated: <DOI>
```

The DOI is written to the Zotero item. I.e., ttach the resulting DOI
to the Zotero record (to the DOI field or to extra if no DOI
field). The Zotero item ID is written to the Zenodo record as above.

### Linking a Zotero item to an existing Zenodo item

```
zotzen --zot 123:ABC --zen 567
```

The Zotero item with item key ABC is fetched (from group 123) and
inspected.

If there is

- no DOI in the Zotero item
- AND the zenodo item with key 567 exists,
- AND the zenodo item does not link to a different Zotero item

then: the items as linked, i.e., the DOI derived from the zenodo item
key 567 is added to the zotero item. The Zotero item id is added to
the Zenodo item as above.

### Sync metadata from zotero to zenodo

```
zotzen --zot 123:ABC --sync
```

- The zotero item metadata is retrieved (as with `--show`).
-- If there's no Zenodo DOI, abort with "This item has no Zenodo DOI. You need to generate or link one first with --getdoi."
-- Check the Zenodo item, and check it links back to the Zotero item. If not, abort with "The Zenodo item exists, but is not linked. You need to link the items with --zen XXX first."
- Then, the Zotero metadata is written to Zenodo item (as above for `--getdoi`).

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
