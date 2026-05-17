/**
 * replace-spinners.js
 * Replaces '⏳ Text…' patterns in JSX files with <><span className="cbf-spin-inline"/>Text…</>
 * and adds import for Spinner if needed (via cbf-spin-inline CSS class — no import required).
 *
 * Pattern matched: '⏳ SomeText'  (single-quoted string starting with ⏳)
 * Replacement:     <><span className="cbf-spin-inline"/>SomeText</>
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const srcDir = path.join(__dirname, 'src')

// Find all JSX files with ⏳
function findJsxFiles(dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findJsxFiles(full))
    } else if (entry.name.endsWith('.jsx')) {
      results.push(full)
    }
  }
  return results
}

const files = findJsxFiles(srcDir)
let totalReplaced = 0
let filesChanged = 0

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  if (!content.includes('⏳')) continue

  // Replace '⏳ SomeText' → <><span className="cbf-spin-inline"/>SomeText</>
  // The pattern: a single-quoted string that starts with ⏳ and a space
  const replaced = content.replace(/'⏳ ([^']+)'/g, (match, text) => {
    return `<><span className="cbf-spin-inline"/>${text}</>`
  })

  if (replaced !== content) {
    const count = (content.match(/'⏳ [^']+'/g) || []).length
    fs.writeFileSync(file, replaced, 'utf8')
    console.log(`  ✓ ${path.relative(srcDir, file)} — ${count} replacement(s)`)
    totalReplaced += count
    filesChanged++
  } else {
    // File has ⏳ but not in single-quoted string form — report it
    const lines = content.split('\n')
    const lineNums = lines
      .map((l, i) => l.includes('⏳') ? i + 1 : null)
      .filter(Boolean)
    console.log(`  ~ ${path.relative(srcDir, file)} — ⏳ found but pattern didn't match (lines: ${lineNums.join(', ')})`)
  }
}

console.log(`\nDone: ${totalReplaced} replacement(s) in ${filesChanged} file(s).`)
