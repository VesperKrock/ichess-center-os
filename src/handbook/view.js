import { articles, chapters, searchConfig, contentErrors, handbookIndex } from './catalog.js'
import { escapeHtml as h, articleHash, parseHandbookHash, renderMarkdown, searchArticles } from './content.js'
import { getHandbookTheme, readHandbookThemePreference, bindHandbookTheme } from './theme.js'

export const HANDBOOK_TITLE = 'Sổ tay iChess V1'
let taskbarObserver
let releaseThemeBinding
export const bookIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></svg>'
const homeIcon = '<svg class="handbook-home-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/></svg>'
const homeLink = className => `<a class="${className}" href="#so-tay" data-handbook-home>${homeIcon}Trang chủ Sổ tay</a>`
export function createHandbookState() {
  return { route: { view: 'home' }, query: '', searchQuery: '', scroll: {}, focus: false, menuOpen: false, themePreference: readHandbookThemePreference() }
}
const routeKey = state => JSON.stringify(state.route)
const statusLabel = article => article.guidance?.mode === 'REFERENCE_ONLY' ? 'Chỉ tham khảo · Đọc giới hạn trong bài'
  : article.guidance?.mode === 'PARTIAL' ? 'Có giới hạn áp dụng · Xem trong bài'
  : 'Hướng dẫn sử dụng'
const card = article => `<a class="handbook-article-card" href="${articleHash(article.id)}" data-handbook-article="${article.id}"><span class="handbook-code">${article.id}</span><strong>${h(article.title)}</strong><span>${h(article.summary)}</span><small>${statusLabel(article)} <span aria-hidden="true">↗</span></small></a>`
function emptyMessage() {
  return `<div class="handbook-empty"><span aria-hidden="true">${bookIcon}</span><h3>Chưa tìm thấy bài phù hợp</h3><p>Thử tên module, tên chức năng hoặc một câu ngắn hơn. Bạn cũng có thể xem mục lục để tìm theo công việc cần làm.</p><a href="#so-tay" data-handbook-home>Xem danh mục 9 module</a></div>`
}
function home() {
  return `<div class="handbook-hero"><span class="handbook-eyebrow">TRA CỨU ĐỂ LÀM VIỆC DỄ HƠN</span><h2 data-handbook-heading tabindex="-1">Bạn cần hướng dẫn gì hôm nay?</h2><p>Từ học viên mới đến một kỳ học tiếp theo.<br>Đọc từng bước, rồi trở lại công việc đang làm.</p><span class="handbook-hero-mark" aria-hidden="true">♞</span></div>
    <section class="handbook-section"><div class="handbook-section-heading"><h3>Hướng dẫn thường dùng</h3><span>${articles.length} bài trong Sổ tay iChess V1</span></div><div class="handbook-cards">${handbookIndex.featured.map(id => articles.find(article => article.id === id)).filter(Boolean).map(card).join('')}</div></section>
    <section class="handbook-section"><h3>Quy trình thường gặp</h3><div class="handbook-workflows">
      ${handbookIndex.workflows.map((flow, i) => `<div><strong>${String(i + 1).padStart(2, '0')} · ${h(flow.title)}</strong><p>${flow.steps.map(step => `<a href="${articleHash(step.article)}" data-handbook-article="${step.article}">${h(step.label)}</a>`).join(' → ')}</p></div>`).join('')}
    </div></section>
    <section class="handbook-section"><h3>Tra cứu theo 9 module</h3><div class="handbook-chapters">${chapters.map((chapter, i) => `<a href="#so-tay/module/${chapter.id}" data-handbook-chapter="${chapter.id}"><span>${String(i + 1).padStart(2, '0')}</span><strong>${h(chapter.title)}</strong><small>${articles.filter(article => article.modules.includes(chapter.id)).length || 'Chưa có'} bài</small></a>`).join('')}</div></section>`
}
function articlePage(article) {
  if (!article) return `<h2 data-handbook-heading tabindex="-1">Không tìm thấy mã bài này</h2><p>Liên kết có thể chưa đúng hoặc bài chưa được bổ sung. Hãy kiểm tra mã, tìm kiếm hoặc mở mục lục.</p>${emptyMessage()}`
  const { html, headings } = renderMarkdown(article.body, import.meta.env.BASE_URL)
  const index = articles.indexOf(article)
  return `<article class="handbook-article"><nav class="handbook-breadcrumb" aria-label="Đường dẫn trong Sổ tay">${homeLink('handbook-breadcrumb-home')}<span aria-hidden="true">/</span><span aria-current="page">${article.id}</span></nav>
    <div class="handbook-article-meta"><span class="handbook-code">${article.id}</span><span class="handbook-draft">${statusLabel(article)}</span></div>
    <h2 data-handbook-heading tabindex="-1">${h(article.title)}</h2><p class="handbook-lead">${h(article.summary)}</p>
    ${article.guidance?.held.length ? `<div class="handbook-verification"><strong>Giới hạn của hướng dẫn</strong><p>Chưa có hướng dẫn vận hành hoàn chỉnh cho:</p><ul>${article.guidance.held.map(branch => `<li>${h(branch.question)}</li>`).join('')}</ul><p>Với các phần này, chỉ tra cứu điều kiện và chuẩn bị thông tin; chưa dùng bài để xác nhận lưu, hủy hoặc xóa dữ liệu.</p></div>` : ''}
    <div class="handbook-article-tools"><button type="button" data-handbook-copy-link="${article.id}">Sao chép liên kết</button><button type="button" data-handbook-download="${article.id}">Tải bài Markdown</button><span role="status" data-handbook-copy-status></span></div>
    <nav class="handbook-toc" aria-label="Trong bài này"><strong>Trong bài này</strong>${headings.map(section => `<button type="button" data-handbook-section="${section.id}">${h(section.title)}</button>`).join('')}</nav>
    <div class="handbook-prose">${html}</div>
    <section class="handbook-related"><h3>Bài liên quan</h3>${article.related.map(id => articles.find(item => item.id === id)).filter(Boolean).map(item => `<a href="${articleHash(item.id)}" data-handbook-article="${item.id}">${item.id} · ${h(item.title)} <span aria-hidden="true">→</span></a>`).join('')}</section>
    <nav class="handbook-next" aria-label="Bài trước và sau">${index > 0 ? `<a href="${articleHash(articles[index - 1].id)}" data-handbook-article="${articles[index - 1].id}">← Bài trước<br><strong>${h(articles[index - 1].title)}</strong></a>` : '<span></span>'}${index < articles.length - 1 ? `<a href="${articleHash(articles[index + 1].id)}" data-handbook-article="${articles[index + 1].id}">Bài tiếp theo →<br><strong>${h(articles[index + 1].title)}</strong></a>` : ''}</nav>
    </article>`
}
export function renderHandbook(state) {
  const route = state.route
  const theme = getHandbookTheme(state)
  let content
  if (route.view === 'article') content = articlePage(articles.find(article => article.id === route.articleId))
  else if (route.view === 'search') {
    const results = searchArticles(articles, route.query, searchConfig)
    content = `${homeLink('handbook-back')}<h2 data-handbook-heading tabindex="-1">Kết quả tìm kiếm</h2><p role="status">${results.length} bài cho “${h(route.query)}”</p>${results.length ? `<div class="handbook-cards">${results.map(card).join('')}</div>` : emptyMessage(route.query)}`
  } else if (route.view === 'chapter') {
    const chapter = chapters.find(item => item.id === route.moduleId)
    const items = articles.filter(article => article.modules.includes(route.moduleId))
    content = `${homeLink('handbook-back')}<span class="handbook-eyebrow">MỤC LỤC THEO MODULE</span><h2 data-handbook-heading tabindex="-1">${h(chapter?.title || 'Không tìm thấy chương')}</h2>${chapter ? `<p class="handbook-lead">${h(chapter.purpose)}</p><p><strong>Quyền và điều kiện:</strong> ${h(chapter.access)}</p><div class="handbook-verification"><strong>Phạm vi hướng dẫn</strong><p>${h(chapter.availability)}</p></div>` : ''}<p>${items.length} bài liên quan đến module này.</p>${items.length ? `<div class="handbook-cards">${items.map(card).join('')}</div>` : emptyMessage()}`
  } else content = home()
  if (contentErrors.length) content = '<p role="status">Một số bài chưa tải được. Vui lòng tải lại trang hoặc báo quản trị viên.</p>' + content
  return `<section class="handbook" data-handbook-theme="${theme}" aria-label="Trung tâm trợ giúp iChess"><header class="handbook-header"><a href="#so-tay" class="handbook-brand" data-handbook-home aria-label="Trang chủ Sổ tay">${bookIcon}<span>SỔ TAY <b>iCHESS</b><small class="handbook-brand-description">Sổ tay iChess V1 · Trung tâm trợ giúp</small><small class="handbook-brand-home">${homeIcon}Trang chủ</small></span></a><form class="handbook-search" role="search" data-handbook-search><label class="sr-only" for="handbook-search-input">Tìm trong Sổ tay</label><span aria-hidden="true">⌕</span><input id="handbook-search-input" type="search" value="${h(state.query)}" placeholder="Bạn muốn làm gì? Tìm câu hỏi, chức năng hoặc mã bài…" maxlength="300" autocomplete="off"><button type="submit">Tìm kiếm</button></form><div class="handbook-header-actions"><div class="handbook-theme-switch" role="group" aria-label="Giao diện Sổ tay"><button type="button" data-handbook-set-theme="light" aria-label="Giao diện sáng cho Sổ tay" aria-pressed="${theme === 'light'}" title="Giao diện sáng cho Sổ tay">Sáng</button><button type="button" data-handbook-set-theme="dark" aria-label="Giao diện tối cho Sổ tay" aria-pressed="${theme === 'dark'}" title="Giao diện tối cho Sổ tay">Tối</button></div><button type="button" class="handbook-menu-toggle" data-handbook-menu aria-expanded="${state.menuOpen}" aria-controls="handbook-sidebar">Mục lục</button></div></header>
    <div class="handbook-layout"><nav class="handbook-sidebar ${state.menuOpen ? 'is-open' : ''}" id="handbook-sidebar" aria-label="Mục lục 9 module"><a class="handbook-home-link" href="#so-tay" data-handbook-home ${route.view === 'home' ? 'aria-current="page"' : ''}>${homeIcon}Trang chủ Sổ tay</a><span class="handbook-eyebrow">9 MODULE · MỤC LỤC</span>${chapters.map((chapter, i) => `<a href="#so-tay/module/${chapter.id}" data-handbook-chapter="${chapter.id}" ${route.moduleId === chapter.id ? 'aria-current="page"' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${h(chapter.title)}</a>`).join('')}<div class="handbook-sidebar-note">Sổ tay giúp bạn tra cứu.<br>Đọc điều kiện và giới hạn trong bài trước khi thao tác tại module.</div></nav><div class="handbook-scroll" tabindex="0" aria-label="Nội dung trợ giúp">${route.view !== 'home' && state.searchQuery ? `<button class="handbook-return-search" type="button" data-handbook-return-search>← Kết quả “${h(state.searchQuery)}”</button>` : ''}${content}<footer class="handbook-footer">Sổ tay iChess V1 · Đọc hướng dẫn, thao tác trong module</footer></div></div></section>`
}

export function bindHandbook(root, state) {
  taskbarObserver?.disconnect()
  releaseThemeBinding?.()
  if (!root) return
  releaseThemeBinding = bindHandbookTheme(root, state)
  const host = root.closest('.is-handbook-window')
  const taskbar = document.querySelector('.taskbar')
  if (host && taskbar) {
    const measure = () => host.style.setProperty('--handbook-taskbar-height', `${Math.ceil(taskbar.getBoundingClientRect().height)}px`)
    measure()
    taskbarObserver = new ResizeObserver(measure)
    taskbarObserver.observe(taskbar)
  }
  const repaint = () => { root.innerHTML = renderHandbook(state); bindHandbook(root, state) }
  const navigate = hash => {
    state.route = parseHandbookHash(hash) || { view: 'home' }
    if (state.route.view === 'search') { state.query = state.route.query; state.searchQuery = state.route.query }
    state.menuOpen = false; state.focus = true
    window.history.pushState(null, '', hash)
    repaint()
  }
  const scroller = root.querySelector('.handbook-scroll')
  const key = routeKey(state)
  const restoreScroll = () => { if (scroller.isConnected) scroller.scrollTop = state.scroll[key] || 0 }
  restoreScroll()
  // Images may complete after restoring an article near its end.
  root.querySelectorAll('img').forEach(img => img.addEventListener('load', restoreScroll, { once: true }))
  scroller.addEventListener('scroll', () => { state.scroll[key] = scroller.scrollTop }, { passive: true })
  if (state.focus) { state.focus = false; root.querySelector('[data-handbook-heading]')?.focus({ preventScroll: true }) }
  root.querySelector('#handbook-search-input').addEventListener('input', event => { state.query = event.target.value })
  root.querySelector('[data-handbook-search]').addEventListener('submit', event => {
    event.preventDefault()
    const query = state.query.trim()
    if (query) navigate('#so-tay/tim?q=' + encodeURIComponent(query))
    else { root.querySelector('#handbook-search-input').focus(); navigate('#so-tay') }
  })
  root.querySelectorAll('[data-handbook-home],[data-handbook-article],[data-handbook-chapter]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(link.getAttribute('href'))
  }))
  root.querySelector('[data-handbook-return-search]')?.addEventListener('click', () => navigate('#so-tay/tim?q=' + encodeURIComponent(state.searchQuery)))
  root.querySelector('[data-handbook-menu]').addEventListener('click', event => {
    state.menuOpen = !state.menuOpen
    root.querySelector('.handbook-sidebar').classList.toggle('is-open', state.menuOpen)
    event.currentTarget.setAttribute('aria-expanded', String(state.menuOpen))
  })
  root.querySelectorAll('[data-handbook-section]').forEach(button => button.addEventListener('click', () => {
    const section = root.querySelector('#' + button.dataset.handbookSection)
    section?.scrollIntoView({ block: 'start' }); section?.focus({ preventScroll: true })
  }))
  const copy = async (text, fallback) => {
    const status = root.querySelector('[data-handbook-copy-status]')
    if (!text.trim()) { if (status) status.textContent = 'Nhập câu hỏi bạn muốn bổ sung trước khi sao chép.'; return }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      if (status?.isConnected) status.textContent = 'Đã sao chép liên kết bài.'
    } catch {
      if (!status?.isConnected) return
      status.textContent = 'Trình duyệt chưa cho sao chép. Chọn nội dung bên dưới và nhấn Ctrl+C (hoặc giữ để sao chép trên điện thoại).'
      const field = fallback || document.createElement('textarea')
      field.value = text; if (!fallback) field.readOnly = true
      field.setAttribute('aria-label', 'Nội dung để sao chép thủ công')
      if (!fallback) status.append(field)
      field.focus(); field.select()
    }
  }
  root.querySelector('[data-handbook-copy-link]')?.addEventListener('click', event => {
    const url = new URL(window.location.href); url.hash = articleHash(event.currentTarget.dataset.handbookCopyLink)
    void copy(url.href)
  })
  root.querySelector('[data-handbook-download]')?.addEventListener('click', event => {
    const article = articles.find(item => item.id === event.currentTarget.dataset.handbookDownload)
    const url = URL.createObjectURL(new Blob([`# ${article.id} · ${article.title}\n\n${article.body}\n`], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = article.id + '.md'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
  // Scoped to this component; business-module keyboard handlers are untouched.
  root.onkeydown = event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); root.querySelector('#handbook-search-input').focus()
    }
    if (event.key === 'Escape' && state.menuOpen) {
      state.menuOpen = false; root.querySelector('.handbook-sidebar').classList.remove('is-open')
      const button = root.querySelector('[data-handbook-menu]'); button.setAttribute('aria-expanded', 'false'); button.focus()
    }
  }
}
