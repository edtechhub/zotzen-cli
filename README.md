# zotzen

@a1diablo. When various import/export issues are working, let's trial this (using the https://github.com/bjohas/Zenodo-tools)

**Step 1**
```
zotero-cli zenodo --doi --key ABC --zenodoapikey XYZ --zenodotemplate something.json
```
The Zotero item ABC is fetched and inspected. 
- If there is no DOI (either in the DOI field or under 'extra'), then 
-- fetch a new record from the Zenodo user with API key XYZ. (It may be good to check whether an API key is available in default locations or as an ENV variable?) Also, add the Zotero metadata to Zenodo (title, abstract, date, authors will be sufficient; this overwrites the something.json, i.e., do a `zenodo-cli create something.json --title ABC --description DEF --date XXX`, not sure about authors.).
-- attach the resulting DOI to the Zotero record (to the DOI field or to extra if no DOI field).
- If there is a DOI, that is a Zenodo DOI, say "A Zenodo-based API key is available and writeable."
- If there is a non-Zotero DOI, or the Zenodo-DOI is not writable, then output a message. 

**Step 2**
```
zotero-cli zenodo --push --key ABC --zenodoapikey XYZ [--type pdf|all]
```
The item now has a DOI (as per Step 1.) 
- The metadata of ABC is updated on Zenodo (as in Step 1). 
- Also, the attachments to ABC are attached to the record
-- --type pdf (default) attached PDF files only. 
-- --type all attached all.


Also
```
zotero-cli zenodo [--publish] [--open]
```
- The Zenodo record is published if --publish
- The Zenodo record is opened if --open

The options --doi/--push/--publish/--open should be combinable.
```
zotero-cli zenodo --doi --key ABC --zenodoapikey XYZ --zenodotemplate something.json --push --publish --open
```
