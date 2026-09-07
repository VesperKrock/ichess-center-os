import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schema = readFileSync('supabase/clean-install/schema.sql', 'utf8')
const manifest = JSON.parse(readFileSync('supabase/clean-install/manifest.json', 'utf8'))

assert.equal(manifest.cleanliness, 'FRESH_INSTANCE_CLEAN')
assert(manifest.applyOrder.some((step) => step.startsWith('apply the CHB-1 overlay migration')))
assert.equal(/^COPY\s/im.test(schema), false)
assert.equal(/^INSERT\s+INTO\s/im.test(schema), false)
assert.equal(/CREATE (?:OR REPLACE )?FUNCTION\s+(?:"public"\.)?"?f23_3e_p3d_execute_conversion/i.test(schema), false)
assert.equal(/CREATE (?:OR REPLACE )?(?:FUNCTION|TABLE)[^\n]*p4b/i.test(schema), false)
assert.equal(/dreamhome|angel wings/i.test(schema), false)
assert.equal(/CREATE SCHEMA\s+"?storage"?/i.test(schema), false)
assert.equal(/CREATE TABLE\s+"storage"\./i.test(schema), false)
assert(manifest.excludedHistoricalMigrations.some((item) => item.startsWith('202608120003')))
assert(manifest.excludedHistoricalMigrations.some((item) => item.startsWith('202608130002')))

console.log('CHB-1 clean-install replay smoke: PASS')
