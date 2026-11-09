// Deliberately small Markdown dialect: headings, paragraphs, lists, quotes,
// bold/code, local article links and local PNG illustrations. No HTML execution.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function parseArticle(raw, filename = '') {
  const match = raw.replaceAll('\r\n', '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`Missing JSON front matter: ${filename}`)
  const meta = JSON.parse(match[1])
  if (!/^[A-Z]{2,4}-\d{3}$/.test(meta.id) || !meta.title || !meta.summary
    || !Array.isArray(meta.modules) || !meta.modules.length
    || !Array.isArray(meta.keywords) || !Array.isArray(meta.questions) || !Array.isArray(meta.related)
    || !['VERIFIED_TECHNICAL', 'EDITORIAL_PENDING', 'APPROVED'].includes(meta.status)) {
    throw new Error(`Invalid article metadata: ${filename}`)
  }
  if (meta.verification?.status === 'VERIFIED_TECHNICAL'
    && (!/^\d{4}-\d{2}-\d{2}$/.test(meta.verification.date) || !meta.verification.revision
      || !meta.verification.sources?.length || !meta.verification.scope)) {
    throw new Error(`Missing technical evidence: ${meta.id}`)
  }
  if (meta.status === 'APPROVED' && (!meta.approval?.reviewer || !meta.approval?.date)) {
    throw new Error(`Approval requires an independent reviewer and date: ${meta.id}`)
  }
  return { ...meta, body: match[2].trim(), raw, filename }
}

export function articleHash(id) { return '#so-tay/' + encodeURIComponent(id) }
export function parseHandbookHash(hash) {
  if (!/^#so-tay(?:\/|$)/.test(hash)) return null
  if (hash === '#so-tay' || hash === '#so-tay/') return { view: 'home' }
  const value = hash.slice('#so-tay/'.length)
  try {
    if (value.startsWith('module/')) return { view: 'chapter', moduleId: decodeURIComponent(value.slice(7)) }
    if (value.startsWith('tim?')) return { view: 'search', query: new URLSearchParams(value.slice(4)).get('q')?.slice(0, 300) || '' }
    return { view: 'article', articleId: decodeURIComponent(value).toUpperCase() }
  } catch { return { view: 'article', articleId: '' } }
}

export function renderMarkdown(body, baseUrl = '/') {
  const headings = []
  const inline = text => {
    const pattern = /\[([^\]\n]+)\]\(([A-Z]{2,4}-\d{3})\.md\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`/g
    let html = '', start = 0
    for (const match of text.matchAll(pattern)) {
      html += escapeHtml(text.slice(start, match.index))
      html += match[1] ? `<a href="${articleHash(match[2])}" data-handbook-article="${match[2]}">${escapeHtml(match[1])}</a>`
        : match[3] ? `<strong>${escapeHtml(match[3])}</strong>` : `<code>${escapeHtml(match[4])}</code>`
      start = match.index + match[0].length
    }
    return html + escapeHtml(text.slice(start))
  }
  const html = body.split(/\n\s*\n/).map(block => {
    const heading = block.match(/^(#{2,3}) (.+)$/)
    if (heading) {
      const id = `handbook-section-${headings.length + 1}`
      headings.push({ id, title: heading[2] })
      return `<h${heading[1].length + 1} id="${id}" tabindex="-1">${inline(heading[2])}</h${heading[1].length + 1}>`
    }
    const image = block.match(/^!\[([^\]]+)\]\((?:\.\.\/){3}public\/handbook\/images\/([A-Za-z0-9-]+\.png)\)$/)
    if (image) return `<figure><a href="${escapeHtml(baseUrl)}handbook/images/${image[2]}" target="_blank" rel="noopener" aria-label="Phóng to: ${escapeHtml(image[1])}"><img src="${escapeHtml(baseUrl)}handbook/images/${image[2]}" alt="${escapeHtml(image[1])}" loading="lazy" width="1400" height="860"></a><figcaption>${escapeHtml(image[1])} · Dữ liệu minh họa. Bấm ảnh để phóng to.</figcaption></figure>`
    const lines = block.split('\n')
    if (lines.every(line => /^\d+\. /.test(line))) return '<ol>' + lines.map(line => `<li>${inline(line.replace(/^\d+\. /, ''))}</li>`).join('') + '</ol>'
    if (lines.every(line => /^- /.test(line))) return '<ul>' + lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('') + '</ul>'
    if (lines.every(line => /^> /.test(line))) return `<blockquote>${inline(lines.map(line => line.slice(2)).join(' '))}</blockquote>`
    return `<p>${inline(block.replaceAll('\n', ' '))}</p>`
  }).join('\n')
  return { html, headings }
}

// Search is deterministic and searches only the authored corpus, never an API.
// Explicit synonym phrases stay reviewable in search-config.json.
export function searchArticles(articles, query, config = {}) {
  let normalized = normalizeSearch(query)
  if (!normalized) return []
  const exact = articles.find(article => normalizeSearch(article.id) === normalized)
  if (exact) return [exact]
  for (const [canonical, synonyms] of Object.entries(config.synonyms || {})) {
    for (const term of synonyms) {
      normalized = (' ' + normalized + ' ').replaceAll(' ' + normalizeSearch(term) + ' ', ' ' + normalizeSearch(canonical) + ' ').trim()
    }
  }
  const stopwords = new Set((config.stopwords || []).map(normalizeSearch))
  const tokens = [...new Set(normalized.split(' ').filter(token => !stopwords.has(token)))]
  if (!tokens.length) return []
  const corpus = articles.map(article => {
    const title = normalizeSearch(article.title)
    const intent = normalizeSearch([...article.questions, ...article.keywords].join(' '))
    const body = normalizeSearch(article.summary + ' ' + article.body)
    const fields = [title, intent, body].map(field => new Set(field.split(' ')))
    return { article, title, intent, body, fields }
  })
  // Unknown vocabulary and unknown article IDs never get speculative matches.
  if (/^[a-z]{2,4} \d{3}$/.test(normalizeSearch(query))
    || tokens.some(token => !corpus.some(item => item.fields.some(field => field.has(token))))) return []
  const shortPhraseMatches = tokens.length <= 3 ? new Set(corpus.filter(item =>
    [item.title, item.intent, item.body].some(field => (' '+field+' ').includes(' '+normalized+' '))).map(item => item.article.id)) : new Set()
  return corpus.map(({ article, fields }) => {
    const matched = tokens.filter(token => fields.some(field => field.has(token)))
    // Conversation can mention the wrong module. Require substantial overlap,
    // with at least two meaningful terms, then favor authored intent phrases.
    const matches = (!shortPhraseMatches.size || shortPhraseMatches.has(article.id))
      && matched.length >= Math.max(Math.min(2, tokens.length), Math.ceil(tokens.length * 0.65))
    const phrases = [...article.keywords, ...article.questions, article.title].map(normalizeSearch)
      .filter(phrase => phrase.split(' ').filter(word => !stopwords.has(word)).length >= 2)
    const phraseScore = Math.max(0, ...phrases.filter(phrase => (' '+normalized+' ').includes(' '+phrase+' ')).map(phrase => phrase.split(' ').length * 6))
    const score = matches ? matched.reduce((sum, token) => sum + (fields[0].has(token) ? 8 : fields[1].has(token) ? 5 : 1), 0)
      + phraseScore - (tokens.length - matched.length) * 4
      + (article.questions.some(question => normalizeSearch(question) === normalizeSearch(query)) ? 50 : 0)
      + (article.keywords.some(keyword => normalizeSearch(keyword) === normalizeSearch(query)) ? 25 : 0) : 0
    return { article, score }
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.article.order - b.article.order)
    .map(item => item.article)
}
