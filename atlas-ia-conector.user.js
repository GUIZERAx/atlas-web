// ==UserScript==
// @name         Atlas IA — Conector Automático
// @namespace    https://atlas-web-production-7d17.up.railway.app
// @version      2.0
// @description  Conecta qualquer roleta ao vivo com o Atlas IA — leitura e apostas automáticas
// @author       Atlas IA
// @match        https://betou.bet.br/*
// @match        https://*.evo-games.com/*
// @match        https://*.evolution.com/*
// @match        https://*.pragmaticplaylive.net/*
// @match        https://*.ezugi.com/*
// @match        https://1pra1.bet.br/*
// @match        https://1pra1.bet/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      atlas-web-production-7d17.up.railway.app
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict'

// ── CONFIG ──────────────────────────────────────
var SERVIDOR = 'https://atlas-web-production-7d17.up.railway.app'
var TOKEN    = GM_getValue('atlasToken', '')

// Se não tem token, pede ao usuário
if (!TOKEN) {
    TOKEN = prompt('Atlas IA — Cole seu token de acesso:')
    if (TOKEN) GM_setValue('atlasToken', TOKEN)
    else return
}

// ── Detectar provedor ───────────────────────────
var _h = location.hostname
var _provedor = 'desconhecido'
if (_h.indexOf('evolution') !== -1 || _h.indexOf('evo-games') !== -1 || _h.indexOf('evogames') !== -1)
    _provedor = 'evolution'
else if (_h.indexOf('pragmatic') !== -1)
    _provedor = 'pragmatic'
else if (_h.indexOf('betou') !== -1)
    _provedor = 'betou'

// ── Seletores por provedor ──────────────────────
var SELS = [
    // Evolution Gaming
    '[class*="number-container"][class*="recent-number"]',
    '[class*="recentNumbers"] [class*="number-container"]',
    '[class*="recentNumbers"] [class*="single-number"]',
    '[class*="single-number--"] span',
    '[class*="numbers-tape"] [class*="number"]',
    '[class*="RouletteHistory"] [class*="item"]',
    '[class*="roulette-history"] [class*="item"]',
    '[class*="ResultHistory"] span',
    '[data-testid*="history"] span',
    '[data-number]',
    // Pragmatic Play
    '.rL_rM .rL_rN',
    '[class*="rL_rN"]',
    '[class*="recentResult"]',
    '[class*="ResultItem"]',
    '[class*="last-results"] span',
    '[class*="results-bar"] span',
    // Genérico
    '[class*="history"] [class*="number"]',
    '[class*="recent"] [class*="number"]',
    '[class*="roulette"] [class*="number"]',
    '.number-history span',
    '[data-role="recent-result"]'
]

function lerPorSeletores(doc) {
    for (var i = 0; i < SELS.length; i++) {
        try {
            var els = doc.querySelectorAll(SELS[i])
            if (!els || els.length < 2) continue
            var seq = []
            els.forEach(function(el) {
                var val = el.getAttribute('data-number') ||
                          el.getAttribute('data-result') ||
                          el.getAttribute('data-value') || ''
                if (!val) {
                    var dt = ''
                    el.childNodes.forEach(function(n) { if (n.nodeType === 3) dt += n.textContent })
                    dt = dt.trim()
                    val = /^\d{1,2}$/.test(dt) ? dt : (el.textContent || el.innerText || '').trim()
                }
                var n = parseInt(val)
                if (!isNaN(n) && n >= 0 && n <= 36 && String(val).replace(/\D/g,'').length <= 2)
                    seq.push(String(n))
            })
            if (seq.length > 1) return seq
        } catch(e) {}
    }
    return null
}

function varredura(doc) {
    var cands = []
    doc.querySelectorAll('span,div,td,li').forEach(function(el) {
        var txt = (el.textContent || el.innerText || '').trim()
        if (!/^\d{1,2}$/.test(txt)) return
        var n = parseInt(txt)
        if (isNaN(n) || n < 0 || n > 36) return
        try {
            var r = el.getBoundingClientRect()
            if (r.width > 4 && r.height > 4 && r.width < 150 && r.height < 150)
                cands.push({ n: String(n), x: r.left, y: r.top })
        } catch(e) {}
    })
    if (cands.length < 3) return null
    var grupos = {}
    cands.forEach(function(c) {
        var y = Math.round(c.y / 10) * 10
        if (!grupos[y]) grupos[y] = []
        grupos[y].push(c)
    })
    var melhorY = null, melhorQ = 0
    Object.keys(grupos).forEach(function(y) {
        if (grupos[y].length > melhorQ) { melhorQ = grupos[y].length; melhorY = y }
    })
    if (!melhorY || melhorQ < 3) return null
    return grupos[melhorY].sort(function(a,b){return a.x-b.x}).map(function(c){return c.n})
}

function lerNumeros() {
    // Tenta na página atual
    var seq = lerPorSeletores(document) || varredura(document)
    if (seq && seq.length > 0) return seq

    // Tenta em todos os iframes
    var frames = document.querySelectorAll('iframe')
    for (var fi = 0; fi < frames.length; fi++) {
        try {
            var doc = frames[fi].contentDocument || frames[fi].contentWindow.document
            seq = lerPorSeletores(doc) || varredura(doc)
            if (seq && seq.length > 0) return seq
        } catch(e) {}
    }
    return null
}

// ── Apostas automáticas ─────────────────────────
var _betOffset = null

function detectOffset(doc) {
    if (_betOffset !== null) return
    var els = doc.querySelectorAll('[data-bet-code]')
    if (!els.length) { _betOffset = 0; return }
    var sample = []
    els.forEach(function(e) {
        var txt = (e.innerText || e.textContent || '').trim()
        var cod = e.getAttribute('data-bet-code')
        var num = parseInt(txt), codN = parseInt(cod)
        if (!isNaN(num) && num >= 0 && num <= 36 && /^\d{1,2}$/.test(txt) && !isNaN(codN))
            sample.push({ num: num, cod: codN })
    })
    _betOffset = sample.length > 0 ? sample[0].cod - sample[0].num : 0
}

function buscarEl(numStr, doc) {
    var n = parseInt(numStr)
    detectOffset(doc)
    var offset = typeof _betOffset === 'number' ? _betOffset : 0
    var codes = [String(n + offset), String(n), String(n*2+2), String(n*2)]
    for (var i = 0; i < codes.length; i++) {
        var el = doc.querySelector('[data-bet-code="' + codes[i] + '"]')
        if (el) return el
    }
    var tags = ['td','th','button','span']
    for (var t = 0; t < tags.length; t++) {
        var els = doc.getElementsByTagName(tags[t])
        for (var ei = 0; ei < els.length; ei++) {
            var txt = (els[ei].innerText || els[ei].textContent || '').trim()
            if (txt === numStr || txt === String(n)) {
                try { var r = els[ei].getBoundingClientRect(); if (r.width > 4 && r.height > 4) return els[ei] } catch(x) { return els[ei] }
            }
        }
    }
    return null
}

function clicar(el) {
    try {
        var r = el.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2
        var opts = { bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy }
        ;['pointerover','pointerenter','mouseover','mouseenter','pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t) {
            try { el.dispatchEvent(new MouseEvent(t, opts)) } catch(x) {}
        })
    } catch(e) {}
}

function apostar(zonas, delay, mult) {
    delay = delay || 50; mult = mult || 1
    // Tenta na página e nos iframes
    var docs = [document]
    document.querySelectorAll('iframe').forEach(function(f) {
        try { docs.push(f.contentDocument || f.contentWindow.document) } catch(e) {}
    })
    var i = 0
    function next() {
        if (i >= zonas.length) return
        var n = String(zonas[i])
        for (var d = 0; d < docs.length; d++) {
            var el = buscarEl(n, docs[d])
            if (el) { for (var m = 0; m < mult; m++) clicar(el); break }
        }
        i++; setTimeout(next, delay)
    }
    next()
}

// ── Enviar número para o Atlas IA ───────────────
var _ultima = ''

function enviarNumero(num, mesa) {
    GM_xmlhttpRequest({
        method: 'POST',
        url: SERVIDOR + '/api/numero',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + TOKEN
        },
        data: JSON.stringify({ numero: num, mesa: mesa || _provedor }),
        onload: function(r) {
            try {
                var d = JSON.parse(r.responseText)
                badge.innerHTML = '🎯 <b>' + num + '</b> <small>(' + (d.clientes||0) + ' online)</small>'
                badge.style.borderColor = '#00ff88'
                setTimeout(function() { badge.style.borderColor = '#00e5ff' }, 1200)
            } catch(e) {}
        },
        onerror: function() {
            badge.style.borderColor = '#ff3366'
            setTimeout(function() { badge.style.borderColor = '#00e5ff' }, 2000)
        }
    })
}

// ── WebSocket para receber comandos de aposta ───
var _ws = null
function conectarWS() {
    try {
        _ws = new WebSocket(SERVIDOR.replace('https://','wss://'))
        _ws.onopen = function() {
            _ws.send(JSON.stringify({ tipo: 'auth', token: TOKEN }))
        }
        _ws.onmessage = function(ev) {
            try {
                var d = JSON.parse(ev.data)
                if (d.tipo === 'apostar') {
                    apostar(d.zonas || [], d.delay || 50, d.mult || 1)
                }
            } catch(e) {}
        }
        _ws.onclose = function() { setTimeout(conectarWS, 4000) }
        _ws.onerror = function() {}
    } catch(e) { setTimeout(conectarWS, 5000) }
}
conectarWS()

// ── Badge visual ────────────────────────────────
var badge = document.createElement('div')
badge.id = '_atlasIA_badge'
badge.style.cssText = [
    'position:fixed',
    'bottom:20px',
    'right:20px',
    'z-index:2147483647',
    'background:#0a0a0f',
    'border:2px solid #00e5ff',
    'border-radius:12px',
    'padding:8px 14px',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'font-size:13px',
    'font-weight:700',
    'color:#00e5ff',
    'cursor:pointer',
    'box-shadow:0 4px 20px rgba(0,229,255,.3)',
    'user-select:none',
    'min-width:120px',
    'text-align:center'
].join(';')
badge.innerHTML = '🎯 Atlas IA <small style="opacity:.6;font-size:10px">iniciando...</small>'
badge.onclick = function() {
    window._atlasIA_ativo = !window._atlasIA_ativo
    if (window._atlasIA_ativo) {
        badge.style.borderColor = '#00e5ff'
        badge.innerHTML = '🎯 Atlas IA <small style="opacity:.6;font-size:10px">ativo</small>'
    } else {
        badge.style.borderColor = '#ff3366'
        badge.innerHTML = '⏸ Atlas IA <small style="opacity:.6;font-size:10px">pausado</small>'
    }
}
document.body.appendChild(badge)

// ── Loop principal ──────────────────────────────
window._atlasIA_ativo = true

setInterval(function() {
    if (!window._atlasIA_ativo) return
    var seq = lerNumeros()
    if (!seq || !seq.length) return
    var chave = seq.slice(0, 5).join(',')
    if (chave === _ultima) return
    _ultima = chave
    var novo = seq[0]
    enviarNumero(novo, document.title || location.hostname)
}, 600)

console.log('[Atlas IA] Userscript ativo — provedor:', _provedor)

})()
