/*
 * converter.js — превращает Markdown в FB2 (FictionBook 2.0).
 * Без зависимостей, кроме marked (vendor/marked.umd.js) и стандартных API браузера.
 * Использование: const r = await Md2Fb2.convert(markdownText, {title, author, lang, genre, images, fileName});
 *   r = { xml, title, warnings: [] }
 *   images — Map: имя файла в нижнем регистре -> dataURL (для картинок, перетащенных вместе с .md)
 */
(function (global) {
  'use strict';

  var BR = '\u0001';
  var NBSP = ' ';

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
  function clean(s) { return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ''); }
  function collapse(s) { return s.replace(/[ \t\r\n]+/g, ' '); }
  function trim(s) { return s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ''); }

  var INLINE = {};
  ('a abbr b bdo big cite code del dfn em font i img input ins kbd label mark q s samp small span strike strong sub sup tt u var br')
    .split(' ').forEach(function (t) { INLINE[t] = true; });
  var UNWRAP = {};
  ('div section article main header footer center body aside nav').split(' ').forEach(function (t) { UNWRAP[t] = true; });
  var SKIP = { script: 1, style: 1, head: 1, noscript: 1 };

  function isInline(node) {
    if (node.nodeType === 3) return true;
    if (node.nodeType !== 1) return false;
    return !!INLINE[node.tagName.toLowerCase()];
  }

  function wrap(tag, inner) {
    if (trim(inner) === '') return inner;
    return '<' + tag + '>' + inner + '</' + tag + '>';
  }

  function wellFormed(fragment) {
    var d = new DOMParser().parseFromString(
      '<r xmlns:l="http://www.w3.org/1999/xlink">' + fragment + '</r>', 'application/xml');
    return d.getElementsByTagName('parsererror').length === 0;
  }

  // ---------- Front matter (--- title: ... ---) ----------
  function parseFrontMatter(text) {
    var m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
    if (!m) return { meta: {}, body: text.replace(/^﻿/, '') };
    var meta = {};
    m[1].split(/\r?\n/).forEach(function (l) {
      var k = /^(\w+)\s*:\s*(.*)$/.exec(l);
      if (k) meta[k[1].toLowerCase()] = k[2].replace(/^["']|["']$/g, '').trim();
    });
    return { meta: meta, body: text.slice(m[0].length), raw: m[0].replace(/^\uFEFF/, '') };
  }

  // ---------- Картинки ----------
  function blobToDataUrl(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  function toPng(dataUrl) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth || 300;
        c.height = img.naturalHeight || 150;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        res(c.toDataURL('image/png'));
      };
      img.onerror = function () { rej(new Error('image decode')); };
      img.src = dataUrl;
    });
  }

  function makeImageLoader(files, warnings) {
    var cache = {};
    var binaries = [];
    var n = 0;

    async function toDataUrl(src) {
      if (/^data:/i.test(src)) return src;
      var name = src;
      try { name = decodeURIComponent(src); } catch (e) { /* оставляем как есть */ }
      var base = name.split(/[\\/]/).pop().toLowerCase();
      if (files && files.has && files.has(base)) return files.get(base);
      if (/^https?:/i.test(src)) {
        try {
          var r = await fetch(src);
          if (!r.ok) return null;
          return await blobToDataUrl(await r.blob());
        } catch (e) { return null; }
      }
      return null;
    }

    async function load(src) {
      if (Object.prototype.hasOwnProperty.call(cache, src)) return cache[src];
      var result = null;
      try {
        var url = await toDataUrl(src);
        if (url) {
          var i = url.indexOf(',');
          var head = url.slice(5, i);
          var data = url.slice(i + 1);
          var mime = head.split(';')[0].toLowerCase() || 'image/png';
          var b64;
          if (/;base64/i.test(head)) b64 = data;
          else b64 = btoa(unescape(encodeURIComponent(decodeURIComponent(data))));
          if (mime !== 'image/jpeg' && mime !== 'image/png') {
            var png = await toPng('data:' + mime + ';base64,' + b64);
            mime = 'image/png';
            b64 = png.slice(png.indexOf(',') + 1);
          }
          n++;
          var id = 'img' + n + (mime === 'image/png' ? '.png' : '.jpg');
          binaries.push('<binary id="' + id + '" content-type="' + mime + '">' + b64.replace(/\s+/g, '') + '</binary>');
          result = { id: id };
        }
      } catch (e) { result = null; }
      if (!result) warnings.push('Картинка не найдена или не загрузилась: ' + (src.length > 80 ? src.slice(0, 80) + '…' : src) +
        ' (перетащите файл картинки вместе с .md)');
      cache[src] = result;
      return result;
    }
    return { load: load, binaries: binaries };
  }

  // ---------- Inline ----------
  async function inline(node, ctx) {
    if (node.nodeType === 3) return esc(clean(collapse(node.nodeValue)));
    if (node.nodeType !== 1) return '';
    var tag = node.tagName.toLowerCase();
    if (SKIP[tag]) return '';
    async function kids() {
      var s = '';
      for (var i = 0; i < node.childNodes.length; i++) s += await inline(node.childNodes[i], ctx);
      return s;
    }
    switch (tag) {
      case 'strong': case 'b': return wrap('strong', await kids());
      case 'em': case 'i': case 'cite': case 'dfn': return wrap('emphasis', await kids());
      case 'del': case 's': case 'strike': return wrap('strikethrough', await kids());
      case 'sub': return wrap('sub', await kids());
      case 'sup': return wrap('sup', await kids());
      case 'code': case 'kbd': case 'samp': case 'tt':
        return wrap('code', esc(clean(collapse(node.textContent))));
      case 'br': return BR;
      case 'a': {
        var href = (node.getAttribute('href') || '').trim();
        var inner = await kids();
        if (/^(https?:|mailto:|ftp:)/i.test(href) && trim(inner) !== '') {
          return '<a l:href="' + escAttr(href) + '">' + inner + '</a>';
        }
        return inner;
      }
      case 'img': {
        var alt = node.getAttribute('alt') || '';
        if (ctx.noImages) return esc(clean(alt));
        var src = node.getAttribute('src') || '';
        var res = src ? await ctx.loader.load(src) : null;
        if (res) { ctx.images.push(res.id); return ''; }
        return esc(clean(alt));
      }
      case 'input':
        if ((node.getAttribute('type') || '').toLowerCase() === 'checkbox') {
          return node.hasAttribute('checked') ? '☑ ' : '☐ ';
        }
        return '';
      default:
        return await kids();
    }
  }

  // ---------- Абзацы ----------
  // Возвращает true, если что-то выведено.
  async function emitPara(nodes, ctx, out, prefix) {
    var c = Object.assign({}, ctx, { images: [] });
    var xml = '';
    for (var i = 0; i < nodes.length; i++) xml += await inline(nodes[i], c);
    xml = trim(xml.split(BR).join(BR));
    // убрать BR по краям
    xml = xml.replace(new RegExp('^(?:\\s|' + BR + ')+|(?:\\s|' + BR + ')+$', 'g'), '');
    var emitted = false;
    if (xml !== '') {
      var full = (prefix || '') + xml;
      var parts = full.split(BR);
      var ok = parts.every(wellFormed);
      if (!ok) parts = [full.split(BR).join(' ')];
      parts.forEach(function (p) {
        p = trim(p);
        if (p !== '') { out.push('<p>' + p + '</p>'); emitted = true; }
      });
    }
    if (!ctx.noImages) {
      c.images.forEach(function (id) { out.push('<image l:href="#' + id + '"/>'); emitted = true; });
    }
    return emitted;
  }

  // ---------- Блоки ----------
  async function blocks(nodes, ctx, out) {
    var run = [];
    async function flush() {
      if (run.length) { var r = run; run = []; await emitPara(r, ctx, out); }
    }
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (isInline(n)) run.push(n);
      else { await flush(); await block(n, ctx, out); }
    }
    await flush();
  }

  async function block(node, ctx, out) {
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (SKIP[tag]) return;
    if (/^h[1-6]$/.test(tag)) {
      var c = Object.assign({}, ctx, { noImages: true, images: [] });
      var xml = '';
      for (var i = 0; i < node.childNodes.length; i++) xml += await inline(node.childNodes[i], c);
      xml = trim(xml.split(BR).join(' '));
      if (xml) out.push('<subtitle>' + xml + '</subtitle>');
      return;
    }
    switch (tag) {
      case 'p': await emitPara(node.childNodes, ctx, out); return;
      case 'ul': case 'ol': await list(node, 0, ctx, out); return;
      case 'blockquote': {
        var inner = [];
        var c2 = Object.assign({}, ctx, { cite: true, noImages: true });
        await blocks(node.childNodes, c2, inner);
        if (inner.length) out.push(ctx.cite ? inner.join('\n') : '<cite>\n' + inner.join('\n') + '\n</cite>');
        return;
      }
      case 'pre': {
        var code = node.textContent.replace(/\n$/, '');
        out.push('<empty-line/>');
        code.split(/\r?\n/).forEach(function (line) {
          if (trim(line) === '') { out.push('<empty-line/>'); return; }
          line = clean(line).replace(/\t/g, '    ').replace(/^ +/, function (m) { return NBSP.repeat(m.length); });
          out.push('<p><code>' + esc(line) + '</code></p>');
        });
        out.push('<empty-line/>');
        return;
      }
      case 'hr': out.push('<subtitle>* * *</subtitle>'); return;
      case 'table': await table(node, ctx, out); return;
      default:
        await blocks(node.childNodes, ctx, out);
    }
  }

  async function list(el, depth, ctx, out) {
    var ordered = el.tagName.toLowerCase() === 'ol';
    var num = parseInt(el.getAttribute('start') || '1', 10);
    if (isNaN(num)) num = 1;
    for (var k = 0; k < el.children.length; k++) {
      var li = el.children[k];
      if (li.tagName.toLowerCase() !== 'li') continue;
      var marker = ordered ? (num++) + '. ' : (depth > 0 ? '◦ ' : '• ');
      var indent = NBSP.repeat(4 * depth);
      var first = true;
      var run = [];
      var self = { first: true };
      var pre = function () { return indent + (self.first ? marker : NBSP.repeat(marker.length)); };
      var flush = async function () {
        if (!run.length) return;
        var r = run; run = [];
        if (await emitPara(r, ctx, out, pre())) self.first = false;
      };
      for (var j = 0; j < li.childNodes.length; j++) {
        var ch = li.childNodes[j];
        if (isInline(ch)) { run.push(ch); continue; }
        await flush();
        var t = ch.tagName ? ch.tagName.toLowerCase() : '';
        if (t === 'ul' || t === 'ol') {
          if (self.first) { out.push('<p>' + indent + marker.trim() + '</p>'); self.first = false; }
          await list(ch, depth + 1, ctx, out);
        } else if (t === 'p') {
          if (await emitPara(ch.childNodes, ctx, out, pre())) self.first = false;
        } else {
          if (self.first) { out.push('<p>' + indent + marker.trim() + '</p>'); self.first = false; }
          await block(ch, ctx, out);
        }
      }
      await flush();
      void first;
    }
  }

  async function table(el, ctx, out) {
    var c = Object.assign({}, ctx, { noImages: true, images: [] });
    var rowsXml = [];
    var rows = el.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var cells = [];
      for (var k = 0; k < rows[r].children.length; k++) {
        var cell = rows[r].children[k];
        var t = cell.tagName.toLowerCase();
        if (t !== 'td' && t !== 'th') continue;
        var xml = '';
        for (var j = 0; j < cell.childNodes.length; j++) xml += await inline(cell.childNodes[j], c);
        xml = trim(xml.split(BR).join(' '));
        var attrs = '';
        var align = (cell.getAttribute('align') || '').toLowerCase();
        if (!align) {
          var m = /text-align\s*:\s*(left|right|center)/i.exec(cell.getAttribute('style') || '');
          if (m) align = m[1].toLowerCase();
        }
        if (align === 'left' || align === 'right' || align === 'center') attrs += ' align="' + align + '"';
        var cs = parseInt(cell.getAttribute('colspan') || '1', 10);
        var rs = parseInt(cell.getAttribute('rowspan') || '1', 10);
        if (cs > 1) attrs += ' colspan="' + cs + '"';
        if (rs > 1) attrs += ' rowspan="' + rs + '"';
        cells.push('<' + t + attrs + '>' + xml + '</' + t + '>');
      }
      if (cells.length) rowsXml.push('<tr>' + cells.join('') + '</tr>');
    }
    if (rowsXml.length) out.push('<table>\n' + rowsXml.join('\n') + '\n</table>');
  }

  // ---------- Секции ----------
  function sectionXml(sec) {
    var inner = '';
    if (sec.title) inner += '<title><p>' + sec.title + '</p></title>\n';
    if (sec.children.length) {
      if (sec.blocks.length) inner += '<section>\n' + sec.blocks.join('\n') + '\n</section>\n';
      inner += sec.children.map(sectionXml).join('\n') + '\n';
    } else {
      inner += (sec.blocks.length ? sec.blocks.join('\n') : '<empty-line/>') + '\n';
    }
    return '<section>\n' + inner + '</section>';
  }

  function* items(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 1 && UNWRAP[n.tagName.toLowerCase()]) yield* items(n.childNodes);
      else yield n;
    }
  }

  function authorXml(name) {
    name = trim(name || '');
    if (!name) return '<author><nickname>Неизвестный автор</nickname></author>';
    var p = name.split(/\s+/).map(function (s) { return esc(clean(s)); });
    if (p.length === 1) return '<author><nickname>' + p[0] + '</nickname></author>';
    if (p.length === 2) return '<author><first-name>' + p[0] + '</first-name><last-name>' + p[1] + '</last-name></author>';
    return '<author><first-name>' + p[0] + '</first-name><middle-name>' + p.slice(1, -1).join(' ') +
      '</middle-name><last-name>' + p[p.length - 1] + '</last-name></author>';
  }

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  // ---------- Главная функция ----------
  async function convert(markdown, opts) {
    opts = opts || {};
    var warnings = [];
    var fm = parseFrontMatter(String(markdown));
    var html = global.marked.parse(fm.body, { gfm: true, breaks: false });
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var loader = makeImageLoader(opts.images, warnings);
    var ctx = { loader: loader, noImages: false, images: [] };

    var root = { level: 0, title: '', blocks: [], children: [] };
    if (fm.raw) {
      fm.raw.split(/\r?\n/).forEach(function (l) {
        if (trim(l) !== '') root.blocks.push('<p>' + esc(clean(l)) + '</p>');
      });
    }
    var stack = [root];
    var firstH1 = '';
    var run = [];

    async function flush() {
      if (!run.length) return;
      var r = run; run = [];
      await emitPara(r, ctx, stack[stack.length - 1].blocks);
    }

    var all = Array.from(items(doc.body.childNodes));
    for (var i = 0; i < all.length; i++) {
      var node = all[i];
      if (node.nodeType === 1 && /^H[1-6]$/.test(node.tagName)) {
        await flush();
        var level = +node.tagName[1];
        if (level === 1 && !firstH1) firstH1 = trim(node.textContent);
        var c = Object.assign({}, ctx, { noImages: true, images: [] });
        var t = '';
        for (var j = 0; j < node.childNodes.length; j++) t += await inline(node.childNodes[j], c);
        t = trim(t.split(BR).join(' '));
        var sec = { level: level, title: t, blocks: [], children: [] };
        while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
        stack[stack.length - 1].children.push(sec);
        stack.push(sec);
      } else if (isInline(node)) {
        run.push(node);
      } else {
        await flush();
        await block(node, ctx, stack[stack.length - 1].blocks);
      }
    }
    await flush();

    // «как есть»: название книги = имя файла; для вставленного текста — первый заголовок
    var title = trim(opts.fileName || '') || firstH1 || 'Без названия';
    var author = trim(opts.author || '');
    var lang = trim(opts.lang || '');
    if (!lang) {
      var cyr = (fm.body.match(/[\u0400-\u04FF]/g) || []).length;
      var lat = (fm.body.match(/[A-Za-z]/g) || []).length;
      lang = cyr >= lat ? 'ru' : 'en';
    }
    var genre = opts.genre || 'nonfiction';
    var today = new Date().toISOString().slice(0, 10);

    var body = '';
    if (root.blocks.length) body += '<section>\n' + root.blocks.join('\n') + '\n</section>\n';
    body += root.children.map(sectionXml).join('\n');
    if (!root.blocks.length && !root.children.length) body = '<section>\n<empty-line/>\n</section>';

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">\n' +
      '<description>\n<title-info>\n<genre>' + esc(genre) + '</genre>\n' + authorXml(author) + '\n' +
      '<book-title>' + esc(clean(title)) + '</book-title>\n<lang>' + esc(lang) + '</lang>\n</title-info>\n' +
      '<document-info>\n<author><nickname>md2fb2</nickname></author>\n<program-used>md2fb2</program-used>\n' +
      '<date value="' + today + '">' + today + '</date>\n<id>' + uuid() + '</id>\n<version>1.0</version>\n</document-info>\n' +
      '</description>\n<body>\n' + body + '\n</body>\n' +
      loader.binaries.join('\n') + (loader.binaries.length ? '\n' : '') +
      '</FictionBook>\n';

    return { xml: xml, title: title, warnings: warnings };
  }

  global.Md2Fb2 = { convert: convert };
})(typeof window !== 'undefined' ? window : globalThis);
