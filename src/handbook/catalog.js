import { getProductionLauncherModules } from '../modules.js'
import { parseArticle } from './content.js'
import searchConfig from './search-config.json'
import handbookIndex from '../../content/handbook/chapters.json'
import guidanceStatus from '../../content/handbook/guidance.json'

// Only the publication corpus is bundled. Internal evidence remains outside this graph.
const files = import.meta.glob('../../content/handbook/articles/*.md', { query: '?raw', import: 'default', eager: true })
export const contentErrors = []
export const articles = Object.entries(files).flatMap(([filename, raw]) => {
  try { const article = parseArticle(raw, filename); return [{ ...article, guidance: guidanceStatus[article.id] }] }
  catch { contentErrors.push(filename.split('/').pop()); return [] }
})
  .sort((a, b) => a.order - b.order)
export const chapters = getProductionLauncherModules().map(module => ({ id: module.id, title: module.name, ...handbookIndex.chapters[module.id] }))
export { searchConfig, handbookIndex }
