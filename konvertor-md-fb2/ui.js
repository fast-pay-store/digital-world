/* ui.js — интерфейс: перетаскивание файлов, вставка текста, скачивание по одному и всё сразу (zip). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var sources = [];            // [{name, text}]
  var images = new Map();      // имя картинки (нижний регистр) -> dataURL
  var done = [];               // готовые книги [{name, bytes}]

  var drop = $('drop'), fileInput = $('file'), textArea = $('text');
  var results = $('results'), status = $('status'), listEl = $('loaded'), allBtn = $('all');

  function setStatus(msg, bad) { status.textContent = msg || ''; status.className = bad ? 'bad' : ''; }
  function baseName(n) { return n.replace(/\.[^.]+$/, ''); }
  function safeName(n) { return n.replace(/[\\/:*?"<>|]/g, '_').trim() || 'книга'; }

  function readAs(file, how) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      if (how === 'text') fr.readAsText(file, 'UTF-8'); else fr.readAsDataURL(file);
    });
  }

  function renderLoaded() {
    listEl.innerHTML = '';
    sources.forEach(function (s) {
      var li = document.createElement('li');
      li.textContent = '📄 ' + s.name;
      listEl.appendChild(li);
    });
    if (images.size) {
      var li = document.createElement('li');
      li.textContent = '🖼 Картинок: ' + images.size;
      listEl.appendChild(li);
    }
  }

  async function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (/\.(md|markdown|mdown|txt)$/i.test(f.name) || f.type.indexOf('text/') === 0) {
        sources.push({ name: f.name, text: await readAs(f, 'text') });
      } else if (/^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.name)) {
        images.set(f.name.toLowerCase(), await readAs(f, 'url'));
      }
    }
    renderLoaded();
    if (sources.length) await run();
  }

  // ---------- скачивание ----------
  function saveBlob(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // Простой zip без сжатия (метод store), имена файлов в UTF-8.
  var crcTable = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(entries) {
    var enc = new TextEncoder();
    var parts = [], central = [], offset = 0;
    var d = new Date();
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    entries.forEach(function (e) {
      var name = enc.encode(e.name), data = e.bytes, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(8, 0, true); h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }

  function uniqueName(name, used) {
    var base = name.replace(/\.fb2$/i, ''), n = name, i = 1;
    while (used[n.toLowerCase()]) { i++; n = base + ' (' + i + ').fb2'; }
    used[n.toLowerCase()] = true;
    return n;
  }

  // ---------- конвертация ----------
  async function run() {
    results.innerHTML = '';
    done = [];
    allBtn.hidden = true;
    var jobs = sources.slice();
    if (textArea.value.trim()) jobs.push({ name: '', text: textArea.value });
    if (!jobs.length) { setStatus('Перетащите .md файл или вставьте текст в окно.', true); return; }
    setStatus('Конвертирую…');
    var used = {};
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      try {
        var r = await Md2Fb2.convert(job.text, { images: images, fileName: baseName(job.name) });
        var fname = uniqueName(safeName(job.name ? baseName(job.name) : r.title) + '.fb2', used);
        var bytes = new TextEncoder().encode(r.xml);
        done.push({ name: fname, bytes: bytes });

        var div = document.createElement('div');
        div.className = 'res';
        var info = document.createElement('div');
        var b = document.createElement('b'); b.textContent = fname;
        var sp = document.createElement('span'); sp.textContent = Math.max(1, Math.round(bytes.length / 1024)) + ' КБ';
        info.appendChild(b); info.appendChild(document.createElement('br')); info.appendChild(sp);
        var btn = document.createElement('button');
        btn.textContent = 'Скачать';
        (function (n, by) {
          btn.onclick = function () { saveBlob(n, new Blob([by], { type: 'application/x-fictionbook+xml' })); };
        })(fname, bytes);
        div.appendChild(info); div.appendChild(btn);
        results.appendChild(div);

        r.warnings.forEach(function (w) {
          var p = document.createElement('div');
          p.className = 'warn';
          p.textContent = '⚠ ' + w;
          results.appendChild(p);
        });
      } catch (e) {
        var er = document.createElement('div');
        er.className = 'warn';
        er.textContent = 'Ошибка в «' + (job.name || 'тексте из окна') + '»: ' + e.message;
        results.appendChild(er);
      }
    }
    allBtn.hidden = done.length < 2;
    setStatus(done.length ? 'Готово: ' + done.length + ' шт.' : 'Не получилось.', !done.length);
  }

  allBtn.addEventListener('click', function () {
    if (done.length) saveBlob('fb2-books.zip', makeZip(done));
  });
  drop.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  $('go').addEventListener('click', run);
  $('clear').addEventListener('click', function () {
    sources = []; images = new Map(); done = []; textArea.value = '';
    results.innerHTML = ''; allBtn.hidden = true; renderLoaded(); setStatus('');
  });
})();
