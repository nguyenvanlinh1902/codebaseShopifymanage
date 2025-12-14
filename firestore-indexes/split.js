/**
 * Split firestore.indexes.json into separate files by collection
 *
 * Usage: node firestore-indexes/split.js
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'firestore.indexes.json');
const OUTPUT_DIR = __dirname;

function stripComments(jsonString) {
  // Remove single-line comments (// ...)
  return jsonString
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
}

function split() {
  const rawContent = fs.readFileSync(INPUT_FILE, 'utf8');
  const cleanContent = stripComments(rawContent);
  const content = JSON.parse(cleanContent);

  // Group indexes by collection
  const indexesByCollection = {};
  for (const index of content.indexes || []) {
    const collection = index.collectionGroup;
    if (!indexesByCollection[collection]) {
      indexesByCollection[collection] = [];
    }
    indexesByCollection[collection].push(index);
  }

  // Group field overrides by collection
  const overridesByCollection = {};
  for (const override of content.fieldOverrides || []) {
    const collection = override.collectionGroup;
    if (!overridesByCollection[collection]) {
      overridesByCollection[collection] = [];
    }
    overridesByCollection[collection].push(override);
  }

  // Get all unique collections
  const allCollections = new Set([
    ...Object.keys(indexesByCollection),
    ...Object.keys(overridesByCollection)
  ]);

  console.log('Splitting firestore.indexes.json into:');

  // Write each collection to its own file
  for (const collection of [...allCollections].sort()) {
    const collectionData = {
      indexes: indexesByCollection[collection] || [],
      fieldOverrides: overridesByCollection[collection] || []
    };

    const fileName = `${collection}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(collectionData, null, 2));
    console.log(
      `  - ${fileName}: ${collectionData.indexes.length} indexes, ${collectionData.fieldOverrides.length} overrides`
    );
  }

  console.log(`\nCreated ${allCollections.size} collection files`);
}

split();
