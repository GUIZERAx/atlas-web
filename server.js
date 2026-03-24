// Atlas IA — Web Server
// Proxy reverso + serve do frontend
// npm install express cors ws
// node server.js

const express = require('express')
const http    = require('http')
const https   = require('https')
const path    = require('path')
const fs      = require('fs')
const crypto  = require('crypto')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// ── Usuários ──────────────────────────────────────────────────
const DB = process.env.DB_FILE || 'usuarios.json'
function lerDB()   { try { return JSON.parse(fs.existsSync(DB) ? fs.readFileSync(DB,'utf8') : '{"u":{}}') } catch(e){ return {u:{}} } }
function salvarDB(db){ fs.writeFileSync(DB, JSON.stringify(db, null, 2)) }

const JWT_SECRET = process.env.JWT_SECRET || 'atlasIA2025secret'

function gerarToken(id) {
  const h = Buffer.from('{"alg":"HS256"}').toString('base64url')
  const b = Buffer.from(JSON.stringify({id, exp: Date.now() + 30*24*3600*1000})).toString('base64url')
  const s = crypto.createHmac('sha256', JWT_SECRET).update(h+'.'+b).digest('base64url')
  return h+'.'+b+'.'+s
}
function verificarToken(tok) {
  try {
    const [h,b,s] = (tok||'').split('.')
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(h+'.'+b).digest('base64url')
    if (sig !== s) return null
    const p = JSON.parse(Buffer.from(b,'base64url').toString())
    if (p.exp < Date.now()) return null
    return p
  } catch(e){ return null }
}
function authMw(req, res, next) {
  const tok = (req.headers.authorization||'').replace('Bearer ','')
  const p   = verificarToken(tok)
  if (!p) return res.status(401).json({erro:'Token inválido'})
  const db  = lerDB()
  const u   = db.u[p.id]
  if (!u || u.status !== 'ativo') return res.status(403).json({erro:'Acesso negado'})
  if (u.expira && new Date(u.expira) < new Date()) return res.status(403).json({erro:'Assinatura expirada em '+new Date(u.expira).toLocaleDateString('pt-BR')})
  req.uid = p.id; req.user = u; next()
}

// ── API Auth ──────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const {usuario, senha} = req.body || {}
  if (!usuario || !senha) return res.status(400).json({erro:'Campos obrigatórios'})
  const db = lerDB()
  const entry = Object.entries(db.u).find(([,u]) => u.usuario===usuario && u.senha===senha)
  if (!entry) return res.status(401).json({erro:'Usuário ou senha incorretos'})
  const [id, u] = entry
  if (u.status !== 'ativo') return res.status(403).json({erro:'Conta inativa'})
  if (u.expira && new Date(u.expira) < new Date()) return res.status(403).json({erro:'Assinatura expirada'})
  res.json({token: gerarToken(id), nome: u.nome, plano: u.plano})
})

app.get('/api/me', authMw, (req, res) => {
  res.json({ok:true, nome:req.user.nome, plano:req.user.plano, expira:req.user.expira})
})

// ── Admin ──────────────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || 'atlas-admin-2025'
function adminMw(req, res, next) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(403).json({erro:'Negado'})
  next()
}
app.post('/api/admin/criar', adminMw, (req, res) => {
  const {usuario, senha, nome, dias} = req.body
  if (!usuario||!senha) return res.status(400).json({erro:'usuario e senha obrigatórios'})
  const db  = lerDB()
  const id  = 'u_' + Date.now()
  const exp = dias ? new Date(Date.now()+dias*86400000).toISOString() : null
  db.u[id]  = {usuario, senha, nome:nome||usuario, plano:'mensal', status:'ativo', expira:exp, criadoEm:new Date().toISOString()}
  salvarDB(db)
  res.json({ok:true, id, usuario, expira:exp})
})
app.get('/api/admin/usuarios', adminMw, (req, res) => res.json(lerDB().u))
app.post('/api/admin/bloquear', adminMw, (req, res) => {
  const db=lerDB(); const u=db.u[req.body.id]
  if(!u) return res.status(404).json({erro:'Não encontrado'})
  u.status='inativo'; salvarDB(db); res.json({ok:true})
})

// ── Proxy reverso ────────────────────────────────────────────
const BLOCK_HEADERS = ['x-frame-options','content-security-policy',
  'cross-origin-embedder-policy','cross-origin-opener-policy','cross-origin-resource-policy',
  'content-security-policy-report-only']

const INJECT_SCRIPT = `// ATLAS-IA-v9.0 — Nova lógica: GATILHO → ENTRA (sem neutro, sem tendência)
// ===== ATLAS IA 1.0 - BETOU.BET.BR 1.0 =====
// ✅ Nova lógica: 2+ conf nos últimos 5 giros após gatilho
// ✅ 10 estratégias atualizadas
// ✅ Aposta automática via data-bet-code (Pragmatic Play)

// =============================================
    // IFRAME: lê histórico e envia via postMessage
    // =============================================

    function lerIframe() {
        // ══ Tenta seletores específicos por provedor primeiro ══
        var seq = _lerPorSeletores()
        if (seq && seq.length > 2) return seq
        // ══ Fallback: varredura inteligente do DOM ══
        return lerIframePorVarredura()
    }

    function _lerPorSeletores() {
        var grupos = [
            // ── Pragmatic Play ──
            ['.rL_rM .rL_rN', '[class*="rL_rN"]',
             '[class*="recentResult"]', '[class*="ResultItem"]',
             '[class*="result-item"]', '[class*="resultItem"]',
             '[class*="last-results"] span', '[class*="lastResults"] span',
             '[class*="results-bar"] span', '[class*="ResultsBar"] span',
             '.resultsBar span', '.results-bar span'],

            // ── Evolution Gaming (seletores 2024/2025) ──
            [
             // === a8-latam.evo-games.com — CONFIRMADO ===
             // Estrutura: <div class="number-container--X recent-number--X">19</div>
             // DOIS seletores combinados (ambas classes no mesmo elemento)
             '[class*="number-container"][class*="recent-number"]',
             '[class*="recentNumbers"] [class*="number-container"]',
             '[class*="recentNumbers"] [class*="single-number"]',
             // Fallback: children value--
             '[class*="recent-number"] [class*="value--"]',
             '[class*="number-container"] [class*="value--"]',
             '[class*="single-number"] [class*="value--"]',
             '[class*="single-number--"] span',
             // === Outros provedores Evolution ===
             '[class*="numbers-tape"] [class*="number"]',
             '[class*="NumbersTape"] [class*="number"]',
             '[class*="numbers-tape"] span',
             '[class*="RouletteHistory"] [class*="item"]',
             '[class*="roulette-history"] [class*="item"]',
             '[class*="RouletteHistory"] span',
             '[class*="last-results"] [class*="number"]',
             '[class*="GameHistory"] [class*="number"]',
             '[class*="History"] [class*="RouletteNumber"]',
             '[class*="ResultHistory"] span',
             '[data-testid*="history"] span',
             '[data-number]',
             '[data-result]'
            ],

            // ── Genéricos ──
            ['[class*="history"] [class*="number"]',
             '[class*="recent"] [class*="number"]',
             '[class*="numbers"] span',
             '[class*="roulette"] [class*="number"]',
             '.number-history span', '.numberHistory span',
             '[data-role="recent-result"]']
        ]

        for (var gi = 0; gi < grupos.length; gi++) {
            for (var si = 0; si < grupos[gi].length; si++) {
                try {
                    var els = document.querySelectorAll(grupos[gi][si])
                    if (!els || els.length < 3) continue
                    var seq = []
                    els.forEach(function(el) {
                        // Tenta data-number primeiro (Evolution usa muito)
                        var val = el.getAttribute('data-number') || el.getAttribute('data-result') ||
                                  el.getAttribute('data-value') || ''
                        // Se não tem data-attr, pega textContent direto (Evolution number-container)
                        if (!val) {
                            // Para number-container: pegar só o texto direto, não de filhos
                            var directText = ''
                            el.childNodes.forEach(function(node) {
                                if (node.nodeType === 3) directText += node.textContent // textNode
                            })
                            directText = directText.trim()
                            // Se texto direto é número válido, usa ele
                            if (/^\\d{1,2}$/.test(directText)) {
                                val = directText
                            } else {
                                // Fallback: textContent completo (para spans simples)
                                val = (el.textContent || el.innerText || '').trim()
                            }
                        }
                        var n = parseInt(val)
                        if (!isNaN(n) && n >= 0 && n <= 36 && String(val).replace(/\\D/g,'').length <= 2)
                            seq.push(String(n))
                    })
                    if (seq.length > 2) return seq
                } catch(e) {}
            }
        }
        return null
    }

    function lerIframePorVarredura() {
        var candidatos = []
        document.querySelectorAll('span, div, td, li, button, p, text, tspan').forEach(function(el) {
            // Permite elementos com filhos se o número está no textNode direto (Evolution)
            if (el.children.length > 0) {
                var directText = ''
                el.childNodes.forEach(function(n){ if(n.nodeType===3) directText += n.textContent })
                directText = directText.trim()
                if (!/^\\d{1,2}$/.test(directText)) return
            }
            var txt = (el.textContent || el.innerText || '').trim()
            if (!/^\\d{1,2}$/.test(txt)) return
            var n = parseInt(txt)
            if (isNaN(n) || n < 0 || n > 36) return
            try {
                var r = el.getBoundingClientRect()
                if (r.width < 4 || r.height < 4 || r.width > 200 || r.height > 200) return
                candidatos.push({ n: String(n), x: r.left, y: r.top })
            } catch(e) {}
        })
        if (candidatos.length < 3) return null
        var grupos = {}
        candidatos.forEach(function(c) {
            var y = Math.round(c.y / 10) * 10
            if (!grupos[y]) grupos[y] = []
            grupos[y].push(c)
        })
        var melhorY = null, melhorQtd = 0
        Object.keys(grupos).forEach(function(y) {
            if (grupos[y].length > melhorQtd) { melhorQtd = grupos[y].length; melhorY = y }
        })
        if (!melhorY || melhorQtd < 3) return null
        var linha = grupos[melhorY]
        linha.sort(function(a, b) { return a.x - b.x })
        return linha.map(function(c) { return c.n })
    }

    // ===== SALDO DO IFRAME =====
    function _enviarSaldo(v) {
        try { window.parent.postMessage({ tipo: 'ATLAS_SALDO', saldo: v }, '*') } catch(e) {}
        try { window.top.postMessage({ tipo: 'ATLAS_SALDO', saldo: v }, '*') } catch(e) {}
    }

    function _parseSaldo(txt) {
        var t = (txt||'').replace(/\\u00a0/g,' ').replace(/R\\$/gi,'').replace(/[^\\d,\\.]/g,'').trim()
        var m = t.match(/(\\d{1,3}(?:\\.\\d{3})*,\\d{2})/) || t.match(/(\\d+,\\d{2})/) || t.match(/(\\d+\\.\\d{2})(?!\\d)/)
        if (!m) return null
        var v = parseFloat(m[1].replace(/\\./g,'').replace(',','.'))
        return (!isNaN(v) && v >= 0 && v < 1000000) ? v : null
    }

    function lerESendSaldo() {
        // ── Evolution: busca valor monetário em elementos visíveis do header ──
        try {
            var evoSels = [
                '[class*="amount--"]',          // confirmado a8-latam (amount--66b1b)
                '[class*="wrapGroup--"]',        // container do saldo
                '[class*="balance"]','[class*="wallet"]',
                '[class*="playerBalance"]','[class*="player-balance"]',
                '[class*="betBalance"]','[class*="userBalance"]',
                '[class*="cash"]','[class*="credit"]'
            ]
            for (var si = 0; si < evoSels.length; si++) {
                var sEls = document.querySelectorAll(evoSels[si])
                for (var sei = 0; sei < sEls.length; sei++) {
                    var sel = sEls[sei]
                    if (sel.children.length > 5) continue
                    try {
                        var sr = sel.getBoundingClientRect()
                        if (sr.width < 1) continue  // elemento oculto
                    } catch(e) {}
                    var sv = _parseSaldo(sel.innerText || sel.textContent)
                    if (sv !== null) { _enviarSaldo(sv); return }
                }
            }
        } catch(e) {}
        // ── Pragmatic: data-testid wallet ──
        try {
            var xpRes = document.evaluate(
                '//*[@data-testid="wallet-mobile-value"] | //*[@data-testid="wallet-mobile-value"]//*',
                document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
            )
            for (var xi = 0; xi < xpRes.snapshotLength; xi++) {
                var xv = _parseSaldo(xpRes.snapshotItem(xi).textContent)
                if (xv !== null) { _enviarSaldo(xv); return }
            }
        } catch(e) {}
        // ── Fallback: valor numérico próximo de SALDO/BALANCE ──
        try {
            document.querySelectorAll('span,div,p').forEach(function(el) {
                if (el.children.length > 3) return
                var fv = _parseSaldo(el.innerText || el.textContent)
                if (fv === null) return
                var p = el.parentElement
                for (var pi = 0; pi < 6; pi++) {
                    if (!p) break
                    var ptxt = (p.innerText||p.textContent||'').toUpperCase()
                    var ptid = (p.getAttribute && p.getAttribute('data-testid')) || ''
                    if (ptxt.indexOf('SALDO') >= 0 || ptxt.indexOf('BALANCE') >= 0 ||
                        ptid.indexOf('wallet') >= 0 || ptid.indexOf('balance') >= 0) {
                        _enviarSaldo(fv); return
                    }
                    p = p.parentElement
                }
            })
        } catch(e) {}
    }

    // Detectar provedor pelo hostname do iframe
    var _provedor = 'desconhecido'
    try {
        var _h = (window.location.hostname + ' ' + window.location.href).toLowerCase()
        if (_h.indexOf('evolution') !== -1 || _h.indexOf('evogames') !== -1 ||
            _h.indexOf('evo-games') !== -1 || _h.indexOf('evolutiongaming') !== -1 ||
            _h.indexOf('cdn-egaming') !== -1 || _h.indexOf('evoimgc') !== -1 ||
            _h.indexOf('evo.games') !== -1 || _h.indexOf('evolutionlive') !== -1)
            _provedor = 'evolution'
        // Wrapper iframe da Betou/Evolution (Amazon S3 ignition.button)
        else if (_h.indexOf('ignition.button') !== -1 || _h.indexOf('ignition') !== -1)
            _provedor = 'evolution_wrapper'
        else if (_h.indexOf('pragmatic') !== -1 || _h.indexOf('pragmaticplay') !== -1)
            _provedor = 'pragmatic'
        console.log('[Atlas IA] Provedor detectado:', _provedor, '| hostname:', window.location.hostname)
    } catch(e) {}

    // Se for wrapper do ignition (Amazon S3), apenas relay — NÃO faz polling
    if (_provedor === 'evolution_wrapper') {
        console.log('[Atlas IA] Wrapper Evolution — relay ativado (sem polling)')
        window.addEventListener('message', function(ev) {
            try {
                if (ev.data && ev.data.tipo) {
                    try { window.parent.postMessage(ev.data, '*') } catch(e) {}
                    try { window.top.postMessage(ev.data, '*') } catch(e) {}
                }
            } catch(e) {}
        })
    }
    var _isWrapper = (_provedor === 'evolution_wrapper')

    // Diagnóstico automático ao carregar (todos provedores)
    setTimeout(function() {
        try {
            var seq = lerIframe()
            console.log('[Atlas IA] Provedor=' + _provedor + ' | Sequência:', seq ? seq.slice(0,10).join(',') : 'NENHUMA')
            if (!seq || seq.length === 0) {
                // Log classes para diagnóstico
                var classes = {}
                document.querySelectorAll('[class]').forEach(function(el) {
                    var cls = el.className || ''
                    if (typeof cls !== 'string') return
                    cls.split(' ').forEach(function(cc) {
                        if (!cc) return
                        var l = cc.toLowerCase()
                        if (l.indexOf('number') !== -1 || l.indexOf('history') !== -1 ||
                            l.indexOf('result') !== -1 || l.indexOf('roulette') !== -1 ||
                            l.indexOf('tape') !== -1 || l.indexOf('last') !== -1)
                            classes[cc] = true
                    })
                })
                console.log('[Atlas IA] Classes relevantes no DOM:', Object.keys(classes).slice(0,40).join(', '))
            }
        } catch(e) {}
    }, 4000)

    var ultimaSeq = ''
    var _tentativas = 0
    var _mutObs = null  // referência ao MutationObserver para reconexão

    function enviarSeSeChanged() {
        var seq = lerIframe()
        if (!seq || seq.length === 0) {
            _tentativas++
            // Log a cada 10 tentativas para diagnóstico
            if (_tentativas % 50 === 0) {
                // Reconectar MutationObserver (pode ter parado)
                try {
                    if (_mutObs) { _mutObs.disconnect() }
                    _mutObs = new MutationObserver(function() {
                        clearTimeout(_mutTimer)
                        _mutTimer = setTimeout(enviarSeSeChanged, 100)
                    })
                    _mutObs.observe(document.body, { childList: true, subtree: true, characterData: false })
                } catch(e) {}
            }
            return
        }
        _tentativas = 0
        var chave = seq.slice(0, 5).join(',')
        if (chave === ultimaSeq) return
        ultimaSeq = chave
        // Enviar para todos os níveis de parent (wrapper → betou)
        try { window.parent.postMessage({ tipo: 'HYPPER_NUMEROS', sequencia: seq, provedor: _provedor }, '*') } catch(e) {}
        try { window.parent.parent.postMessage({ tipo: 'HYPPER_NUMEROS', sequencia: seq, provedor: _provedor }, '*') } catch(e) {}
        try { window.top.postMessage({ tipo: 'HYPPER_NUMEROS', sequencia: seq, provedor: _provedor }, '*') } catch(e) {}
    }

    // Polling: só no iframe do jogo real, não no wrapper
    if (!_isWrapper) {
        setInterval(enviarSeSeChanged, 300)
        setInterval(lerESendSaldo, 2000)
    }

    // MutationObserver: só no iframe do jogo real
    var _mutTimer = null
    if (!_isWrapper) {
        try {
            _mutObs = new MutationObserver(function() {
                clearTimeout(_mutTimer)
                _mutTimer = setTimeout(enviarSeSeChanged, 100)
            })
            _mutObs.observe(document.body, { childList: true, subtree: true, characterData: false })
        } catch(e) {}
    }


    // ================================================================
    // APOSTA AUTOMÁTICA — dentro do iframe (acesso direto ao DOM)
    // ================================================================

    function dispararEventos(el) {
        if (!el) return
        try {
            var r = el.getBoundingClientRect()
            var cx = r.left + r.width / 2
            var cy = r.top + r.height / 2
            var opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }
            ;['pointerover','pointerenter','mouseover','mouseenter',
              'pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t) {
                try { el.dispatchEvent(new MouseEvent(t, opts)) } catch(x) {}
            })
        } catch(e) {}
    }

    // Cache do formato data-bet-code detectado automaticamente
    var _betCodeOffset = null

    function detectarBetCodeOffset() {
        if (_betCodeOffset !== null) return
        // Testa numero 0 e 1 com codigo direto ou n*2+2
        var testes = [
            [0, 0], [0, 2], [1, 1], [1, 4], [2, 2], [2, 6]
        ]
        var betEls = document.querySelectorAll('[data-bet-code]')
        if (betEls.length === 0) { _betCodeOffset = 'direto'; return }
        // Descobre pelo texto vs codigo
        var sample = []
        betEls.forEach(function(e) {
            var txt = (e.innerText || e.textContent || '').trim()
            var cod = e.getAttribute('data-bet-code')
            var num = parseInt(txt)
            var codNum = parseInt(cod)
            if (!isNaN(num) && num >= 0 && num <= 36 && !isNaN(codNum) && txt.match(/^\\d{1,2}$/)) {
                sample.push({ num: num, cod: codNum })
            }
        })
        if (sample.length > 0) {
            var diff = sample[0].cod - sample[0].num
            _betCodeOffset = diff
            console.log('[Atlas] bet-code offset=' + diff + ' (cod=' + sample[0].cod + ' num=' + sample[0].num + ')')
        } else {
            _betCodeOffset = 0
        }
    }

    function numParaBetCode(n) {
        detectarBetCodeOffset()
        if (typeof _betCodeOffset === 'number') {
            // Tenta offset detectado primeiro, depois fallbacks
            var codes = [String(n + _betCodeOffset)]
            if (_betCodeOffset !== 0) codes.push(String(n))
            codes.push(String(n*2+2), String(n*2), String(n*2+1))
            return codes
        }
        return [String(n), String(n*2+2), String(n*2), String(n+1)]
    }

    // Procura elemento de aposta de TODAS as formas possíveis
    function buscarElementoNumero(numStr) {
        var n = parseInt(numStr)

        // 1) data-bet-code: número EXATO primeiro, depois offset detectado
        var codigos = numParaBetCode(n)
        for (var ci = 0; ci < codigos.length; ci++) {
            var e = document.querySelector('[data-bet-code="'+codigos[ci]+'"]')
            if (e) return e
        }

        // 2) qualquer atributo data-* contendo bet/num/code com valor = número exato
        var todos = document.querySelectorAll('*')
        for (var ti = 0; ti < todos.length; ti++) {
            var el = todos[ti]
            var attrs = el.attributes
            if (!attrs) continue
            for (var ai = 0; ai < attrs.length; ai++) {
                var an = attrs[ai].name, av = attrs[ai].value
                if (av === numStr &&
                    (an.indexOf('bet') >= 0 || an.indexOf('num') >= 0 ||
                     an.indexOf('code') >= 0 || an.indexOf('spot') >= 0)) {
                    return el
                }
            }
        }

        // 3) elemento com texto EXATO = número e visível
        var tags = ['td','th','button','span','div','li']
        for (var tg = 0; tg < tags.length; tg++) {
            var els = document.getElementsByTagName(tags[tg])
            for (var ei = 0; ei < els.length; ei++) {
                var txt = (els[ei].innerText || els[ei].textContent || '').trim()
                if (txt === numStr || txt === String(n)) {
                    try {
                        var r2 = els[ei].getBoundingClientRect()
                        if (r2.width > 4 && r2.height > 4) return els[ei]
                    } catch(x) { return els[ei] }
                }
            }
        }

        return null
    }

    // Log de diagnóstico — mostra os primeiros elementos clicáveis da mesa
    function logDiagnostico() {
        console.log('[Atlas iframe] === DIAGNÓSTICO DA MESA ===')

        // Todos data-bet-code existentes
        var betCodes = document.querySelectorAll('[data-bet-code]')
        if (betCodes.length > 0) {
            console.log('[Atlas iframe] data-bet-code encontrados (' + betCodes.length + '):')
            var sample = []
            betCodes.forEach(function(e) { sample.push(e.getAttribute('data-bet-code')) })
            console.log('  valores:', sample.slice(0,20).join(', '))
        } else {
            console.log('[Atlas iframe] bet-code ainda carregando...')
        }

        // Primeiros tds/buttons com números
        var numericos = []
        document.querySelectorAll('td, button, [role="gridcell"], [role="cell"]').forEach(function(e) {
            var txt = (e.innerText || e.textContent || '').trim()
            var n = parseInt(txt)
            if (!isNaN(n) && n >= 0 && n <= 36 && String(n) === txt) {
                var attrs = []
                for (var ai = 0; ai < e.attributes.length; ai++) {
                    attrs.push(e.attributes[ai].name + '="' + e.attributes[ai].value + '"')
                }
                numericos.push(txt + ' → <' + e.tagName.toLowerCase() +
                    (e.className ? ' class="'+e.className+'"' : '') +
                    (attrs.length ? ' ' + attrs.join(' ') : '') + '>')
            }
        })
        if (numericos.length > 0) {
            console.log('[Atlas iframe] Elementos numéricos encontrados (' + numericos.length + '):')
            numericos.slice(0, 10).forEach(function(s) { console.log('  ' + s) })
        } else {
            console.log('[Atlas iframe] mesa ainda carregando...')
            // Mostra primeiros 5 filhos do body como referência
            var children = document.body.children
            for (var ci = 0; ci < Math.min(3, children.length); ci++) {
                console.log('[Atlas iframe] body.children['+ci+']:', children[ci].tagName, children[ci].className)
            }
        }
        console.log('[Atlas iframe] === FIM DIAGNÓSTICO ===')
    }

    // Detecta se a mesa está aberta para apostas
    function mesaAberta() {
        // Verifica se há elementos de aposta visíveis e clicáveis
        var betEls = document.querySelectorAll('[data-bet-code]')
        if (betEls.length > 5) return true
        // Tenta pelo texto numérico visível
        var visíveis = 0
        document.querySelectorAll('td,button').forEach(function(e) {
            var txt = (e.innerText||e.textContent||'').trim()
            var n = parseInt(txt)
            if (!isNaN(n) && n >= 0 && n <= 36 && String(n) === txt) {
                try { var r = e.getBoundingClientRect(); if (r.width > 4) visíveis++ } catch(x) {}
            }
        })
        return visíveis >= 10
    }

    function executarApostasIframe(zonas, delay, mult) {
        console.log('[Atlas iframe] 🤖 APOSTAR: [' + zonas.join(', ') + ']')
        _betCodeOffset = null

        var tentativas = 0
        var maxTentativas = 10

        function tentarApostar() {
            tentativas++
            if (!mesaAberta() && tentativas < maxTentativas) {
                setTimeout(tentarApostar, 300)
                return
            }
            if (tentativas >= maxTentativas && !mesaAberta()) {
                console.warn('[Atlas iframe] ⚠️ Mesa não abriu em tempo hábil')
                return
            }
            console.log('[Atlas iframe] ✅ Mesa aberta! Apostando...')
            detectarBetCodeOffset()

            // Aposta em lote — todos os cliques em rápida sequência
            var d = Math.max(delay || 30, 20) // mínimo 20ms entre cliques
            zonas.forEach(function(numStr, i) {
                setTimeout(function() {
                    var el = buscarElementoNumero(numStr)
                    if (el) {
                        for (var k = 0; k < (mult || 1); k++) {
                            setTimeout(function() { dispararEventos(el) }, k * 20)
                        }
                    } else {
                        // Retry rápido após 150ms
                        setTimeout(function() {
                            var el2 = buscarElementoNumero(numStr)
                            if (el2) {
                                for (var k = 0; k < (mult || 1); k++) {
                                    setTimeout(function() { dispararEventos(el2) }, k * 20)
                                }
                            }
                        }, 150)
                    }
                }, d * i)
            })
        }

        tentarApostar()
    }

    // ===== ANTI-INATIVIDADE dentro do iframe =====
    setInterval(function() {
        try {
            var pauseWords = ['pausa por inatividade', 'clique em qualquer lugar', 'inactivity', 'click to continue', 'click anywhere']
            var bodyTxt = (document.body.innerText || document.body.textContent || '').toLowerCase()
            if (!pauseWords.some(function(w) { return bodyTxt.indexOf(w) !== -1 })) return
            var cx = window.innerWidth / 2, cy = window.innerHeight / 2
            var alvo = document.elementFromPoint(cx, cy) || document.body
            alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window }))
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx, clientY: cy, view: window }))
            window.parent.postMessage({ tipo: 'ATLAS_PAUSA_DETECTADA' }, '*')
        } catch(e) {}
    }, 4000)

    // ===== LISTENER DE MENSAGENS DO IFRAME =====
    var _ultimoIdProcessado = -1
    window.addEventListener('message', function(ev) {
        if (!ev.data) return
        if (ev.data.tipo === 'ATLAS_CANCELAR') {
            // Cancela apostas em andamento — reseta cache
            _betCodeOffset = null
            return
        }
        if (ev.data.tipo === 'ATLAS_APOSTAR') {
            // Deduplicação: ignora se já processamos este ID
            var msgId = ev.data.id
            if (msgId !== undefined && msgId === _ultimoIdProcessado) {
                console.log('[Atlas iframe] ⏩ Mensagem duplicada ignorada id=' + msgId)
                return
            }
            if (msgId !== undefined) _ultimoIdProcessado = msgId
            // Executa neste frame
            executarApostasIframe(ev.data.zonas || [], ev.data.delay || 150, ev.data.mult || 1)
            // Encaminha para iframes filhos (o jogo pode estar em frame aninhado)
            document.querySelectorAll('iframe').forEach(function(f) {
                try { f.contentWindow.postMessage(ev.data, '*') } catch(e) {}
            })
        }
    })

    // Roda diagnóstico automaticamente 3s após carregar
    // setTimeout(logDiagnostico, 3000)  // desativado
`


app.use('/proxy', (req, res) => {
  let targetUrl = decodeURIComponent(req.query.url || req.path.slice(1))
  if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl

  let parsed
  try { parsed = new URL(targetUrl) } catch(e) { return res.status(400).send('URL inválida') }

  const mod = parsed.protocol === 'https:' ? https : require('http')
  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol==='https:'?443:80),
    path: parsed.pathname + parsed.search,
    method: req.method,
    headers: {
      'host': parsed.hostname,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'accept-encoding': 'identity',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'cache-control': 'max-age=0',
      'origin': parsed.origin,
      'referer': parsed.origin + '/',
      // Passa cookies do usuário (importante para sessão logada)
      ...(req.headers['cookie'] ? { 'cookie': req.headers['cookie'] } : {}),
    }
  }

  const pr = mod.request(opts, pRes => {
    const nh = {}
    for (const [k,v] of Object.entries(pRes.headers)) {
      if (!BLOCK_HEADERS.includes(k.toLowerCase())) nh[k] = v
    }
    const ct = (pRes.headers['content-type']||'').toLowerCase()
    if (ct.includes('text/html')) {
      const chunks = []
      pRes.on('data', c => chunks.push(c))
      pRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf8')
        const base = parsed.origin
        body = body
          .replace(/href="\/(?!\/)/g, `href="${base}/`)
          .replace(/src="\/(?!\/)/g,  `src="${base}/`)
          .replace(/action="\/(?!\/)/g, `action="${base}/`)
        const injectTag = `<script>${INJECT_SCRIPT}<\/script>`
        if (body.includes('</head>')) body = body.replace('</head>', injectTag+'</head>')
        else body += injectTag
        delete nh['content-length']; delete nh['transfer-encoding']
        nh['content-length'] = Buffer.byteLength(body)
        res.writeHead(pRes.statusCode, nh)
        res.end(body)
      })
    } else {
      res.writeHead(pRes.statusCode, nh)
      pRes.pipe(res)
    }
  })
  pr.on('error', e => { if(!res.headersSent) res.status(502).send('Proxy: '+e.message) })
  if (!['GET','HEAD'].includes(req.method)) req.pipe(pr)
  else pr.end()
})

// ── Rota que recebe número do bookmarklet ──────────────
app.post('/api/numero', authMw, (req, res) => {
    const num  = String(req.body.numero || '')
    const mesa = req.body.mesa || 'roleta'
    if (!num || isNaN(parseInt(num)) || parseInt(num) < 0 || parseInt(num) > 36) {
        return res.status(400).json({ erro: 'Número inválido' })
    }
    console.log('[Atlas] Número recebido:', num, '| mesa:', mesa, '| usuário:', req.uid)
    // Broadcast para todos os clientes WS conectados
    const payload = JSON.stringify({ tipo: 'numero', numero: num, mesa: mesa })
    wsClients.forEach(c => {
        try { if (c.readyState === 1) c.send(payload) } catch(e) {}
    })
    res.json({ ok: true, clientes: wsClients.length })
})

// ── Serve o userscript Tampermonkey ──────────────────────────
app.get('/instalar', authMw, (req, res) => {
    // Gera userscript com token do usuário embutido
    let script = USERSCRIPT_TEMPLATE.replace(
        "var TOKEN    = GM_getValue('atlasToken', '')",
        "var TOKEN    = GM_getValue('atlasToken', '" + req.user.token_cached + "')"
    )
    // Injeta token do usuário diretamente
    const token = gerarToken(req.uid)
    script = script.replace(
        "var TOKEN    = GM_getValue('atlasToken', '')",
        "var TOKEN    = '" + token + "' // auto-configurado"
    )
    res.setHeader('Content-Type', 'application/x-userscript')
    res.setHeader('Content-Disposition', 'attachment; filename="atlas-ia-conector.user.js"')
    res.send(script)
})

// Página de instalação (não precisa de auth)
app.get('/instalar-info', (req, res) => {
    res.redirect('/?info=instalar')
})

// ── Serve frontend ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))


// ============================================================
// SCRAPER — WebSocket Evolution Gaming (dados públicos)
// Conecta nas mesas ao vivo e captura números em tempo real
// ============================================================

const EVO_MESAS = {
    'auto-roulette':        'wss://a8-latam.evo-games.com/public/roulette/auto-roulette-1',
    'speed-auto-roulette':  'wss://a8-latam.evo-games.com/public/roulette/speed-auto-roulette-1',
    'lightning-roulette':   'wss://a8-latam.evo-games.com/public/roulette/lightning-roulette-1',
    'immersive-roulette':   'wss://a8-latam.evo-games.com/public/roulette/immersive-roulette-1',
    'roulette-1':           'wss://a8-latam.evo-games.com/public/roulette/roulette-1',
    'brazilian-roulette':   'wss://casinobr.pragmaticplaylive.net/ws/roulette/live',
}

// Mesas ativas (configurável pelo admin)
var mesasAtivas = (process.env.MESAS_ATIVAS || 'auto-roulette,speed-auto-roulette').split(',')

var scraperConexoes = {}
var ultimosNumeros  = {}  // { mesa: [n1, n2, ...] }

function iniciarScraper() {
    mesasAtivas.forEach(function(mesa) {
        conectarMesa(mesa.trim())
    })
    console.log('[Scraper] Iniciado para mesas:', mesasAtivas)
}

function conectarMesa(mesa) {
    const wsUrl = EVO_MESAS[mesa]
    if (!wsUrl) {
        console.log('[Scraper] Mesa desconhecida:', mesa)
        return
    }
    if (scraperConexoes[mesa] && scraperConexoes[mesa].readyState <= 1) return

    console.log('[Scraper] Conectando em:', mesa, wsUrl)

    const { WebSocket: WS } = require('ws')
    const ws = new WS(wsUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Origin': 'https://betou.bet.br',
        }
    })

    scraperConexoes[mesa] = ws

    ws.on('open', function() {
        console.log('[Scraper] Conectado:', mesa)
        // Solicita histórico e subscrição ao feed de resultados
        try {
            ws.send(JSON.stringify({
                type: 'subscribe',
                channel: 'results',
                table: mesa
            }))
            ws.send(JSON.stringify({ type: 'history', count: 20 }))
            ws.send(JSON.stringify({ MT: 'subscribe', S: 'result' }))
        } catch(e) {}
    })

    ws.on('message', function(raw) {
        try {
            const txt = raw.toString()
            const data = JSON.parse(txt)
            const num = extrairNumero(data, mesa)
            if (num !== null && num !== undefined && !isNaN(num) && num >= 0 && num <= 36) {
                const numStr = String(num)
                if (!ultimosNumeros[mesa]) ultimosNumeros[mesa] = []
                if (ultimosNumeros[mesa][0] === numStr) return // duplicado
                ultimosNumeros[mesa].unshift(numStr)
                if (ultimosNumeros[mesa].length > 50) ultimosNumeros[mesa].pop()
                console.log('[Scraper]', mesa, '→ número:', numStr)
                // Broadcast para todos os clientes WS
                broadcastNumero(numStr, mesa)
            }
        } catch(e) {}
    })

    ws.on('close', function(code) {
        console.log('[Scraper] Desconectado:', mesa, 'code:', code)
        scraperConexoes[mesa] = null
        setTimeout(function() { conectarMesa(mesa) }, 5000)
    })

    ws.on('error', function(e) {
        console.log('[Scraper] Erro:', mesa, e.message)
        scraperConexoes[mesa] = null
        setTimeout(function() { conectarMesa(mesa) }, 8000)
    })

    // Ping keepalive
    setInterval(function() {
        if (ws.readyState === 1) {
            try { ws.send(JSON.stringify({ type: 'ping' })) } catch(e) {}
        }
    }, 30000)
}

function extrairNumero(data, mesa) {
    // Formatos conhecidos da Evolution Gaming WS
    // Formato 1: { result: { outcome: 17 } }
    if (data.result && data.result.outcome !== undefined) return data.result.outcome
    // Formato 2: { data: { result: 17 } }
    if (data.data && data.data.result !== undefined) return data.data.result
    // Formato 3: { outcome: 17 }
    if (data.outcome !== undefined) return data.outcome
    // Formato 4: { winningNumber: 17 }
    if (data.winningNumber !== undefined) return data.winningNumber
    // Formato 5: { number: 17 }
    if (data.number !== undefined && typeof data.number === 'number') return data.number
    // Formato 6: { MT: "result", Outcome: 17 }
    if (data.MT === 'result' && data.Outcome !== undefined) return data.Outcome
    // Formato 7: { type: "RESULT", value: 17 }
    if (data.type === 'RESULT' && data.value !== undefined) return data.value
    // Formato 8: history array
    if (data.history && Array.isArray(data.history) && data.history.length > 0) {
        const first = data.history[0]
        if (typeof first === 'number') return first
        if (first.number !== undefined) return first.number
        if (first.outcome !== undefined) return first.outcome
        if (first.result !== undefined) return first.result
    }
    // Formato 9: results array
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        const first = data.results[0]
        if (typeof first === 'number') return first
        if (first && first.number !== undefined) return first.number
    }
    return null
}

function broadcastNumero(num, mesa) {
    const payload = JSON.stringify({ tipo: 'numero', numero: num, mesa: mesa, source: 'auto' })
    wsClients.forEach(function(c) {
        try { if (c.readyState === 1) c.send(payload) } catch(e) {}
    })
}

// Endpoint para ver status do scraper
app.get('/api/scraper/status', authMw, function(req, res) {
    const status = {}
    Object.keys(EVO_MESAS).forEach(function(mesa) {
        const ws = scraperConexoes[mesa]
        status[mesa] = {
            ativo: mesasAtivas.includes(mesa),
            conectado: ws && ws.readyState === 1,
            ultimoNumero: ultimosNumeros[mesa] ? ultimosNumeros[mesa][0] : null,
            historico: (ultimosNumeros[mesa] || []).slice(0, 10),
        }
    })
    res.json({ mesas: status, total_clientes_ws: wsClients.length })
})

// Endpoint admin para ativar/desativar mesa
app.post('/api/scraper/mesa', adminMw, function(req, res) {
    const { mesa, ativo } = req.body
    if (!EVO_MESAS[mesa]) return res.status(400).json({ erro: 'Mesa inválida' })
    if (ativo && !mesasAtivas.includes(mesa)) {
        mesasAtivas.push(mesa)
        conectarMesa(mesa)
    } else if (!ativo) {
        mesasAtivas = mesasAtivas.filter(function(m){ return m !== mesa })
        if (scraperConexoes[mesa]) {
            try { scraperConexoes[mesa].close() } catch(e) {}
            scraperConexoes[mesa] = null
        }
    }
    res.json({ ok: true, mesasAtivas })
})


const server = http.createServer(app)
const { WebSocketServer } = require('ws')
const wss = new WebSocketServer({ server })
var wsClients = []

wss.on('connection', function(ws) {
    ws.on('message', function(raw) {
        try {
            const d = JSON.parse(raw)
            if (d.tipo === 'ping') { ws.send(JSON.stringify({ tipo: 'pong' })); return }
            if (d.tipo === 'auth') {
                const p = verificarToken(d.token)
                if (p) {
                    ws.atlasUserId = p.id
                    wsClients.push(ws)
                    ws.send(JSON.stringify({ tipo: 'auth_ok' }))
                    console.log('[WS] Cliente conectado:', p.id, '| Total:', wsClients.length)
                } else {
                    ws.send(JSON.stringify({ tipo: 'auth_erro' }))
                }
            }
        } catch(e) {}
    })
    ws.on('close', function() {
        wsClients = wsClients.filter(function(c){ return c !== ws })
        console.log('[WS] Cliente saiu. Total:', wsClients.length)
    })
    ws.on('error', function(){})
})

server.listen(PORT, () => {
    console.log('[Atlas IA] Porta', PORT, '| WS ativo')
    // Inicia scraper de números da Evolution após 3s
    setTimeout(iniciarScraper, 3000)
})
