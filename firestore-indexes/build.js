/**
 * Build script to merge all collection index files into firestore.indexes.json
 *
 * Usage: node firestore-indexes/build.js
 */

const fs = require('fs');
const path = require('path');

const INDEXES_DIR = path.join(__dirname);
const OUTPUT_FILE = path.join(__dirname, '..', 'firestore.indexes.json');

function build() {
  const result = {
    indexes: [],
    fieldOverrides: []
  };

  // Read all JSON files in the directory
  const files = fs
    .readdirSync(INDEXES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log('Building firestore.indexes.json from:');

  for (const file of files) {
    const filePath = path.join(INDEXES_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const indexCount = content.indexes?.length || 0;
    const overrideCount = content.fieldOverrides?.length || 0;
    console.log(`  - ${file}: ${indexCount} indexes, ${overrideCount} overrides`);

    if (content.indexes) {
      result.indexes.push(...content.indexes);
    }
    if (content.fieldOverrides) {
      result.fieldOverrides.push(...content.fieldOverrides);
    }
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));

  console.log(`\nOutput: firestore.indexes.json`);
  console.log(`  Total indexes: ${result.indexes.length}`);
  console.log(`  Total field overrides: ${result.fieldOverrides.length}`);
}

build();
