/* ui.js — интерфейс страницы: перетаскивание файлов, вставка текста, кнопки скачивания. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var sources = [];            // [{name, text}]
  var images = new Map();      // имя картинки (нижний регистр) -> dataURL

  var drop = $('drop'), fileInput = $('file'), textArea = $('text');
  var results = $('results'), status = $('status'), listEl = $('loaded');

  function setStatus(msg, bad) {
    status.textContent = msg || '';
    status.className = bad ? 'bad' : '';
  }

  function readText(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsText(file, 'UTF-8');
    });
  }
  function readDataUrl(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsDataURL(file);
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
        sources.push({ name: f.name, text: await readText(f) });
      } else if (/^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.name)) {
        images.set(f.name.toLowerCase(), await readDataUrl(f));
      }
    }
    renderLoaded();
    if (sources.length) await run();
  }

  function baseName(n) { return n.replace(/\.[^.]+$/, ''); }

  function download(name, xml) {
    var blob = new Blob([xml], { type: 'application/x-fictionbook+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function run() {
    results.innerHTML = '';
    var jobs = sources.slice();
    var pasted = textArea.value;
    if (pasted.trim()) jobs.push({ name: 'книга.md', text: pasted });
    if (!jobs.length) { setStatus('Перетащите .md файл или вставьте текст в окно.', true); return; }
    setStatus('Конвертирую…');
    var ok = 0;
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      try {
        var r = await Md2Fb2.convert(job.text, {
          title: jobs.length === 1 ? $('title').value : '',
          author: $('author').value,
          lang: $('lang').value,
          genre: $('genre').value,
          images: images,
          fileName: baseName(job.name)
        });
        var fname = (jobs.length === 1 && $('title').value.trim() ? $('title').value.trim() : baseName(job.name)) + '.fb2';
        fname = fname.replace(/[\\/:*?"<>|]/g, '_');
        var div = document.createElement('div');
        div.className = 'res';
        var info = document.createElement('div');
        info.innerHTML = '<b></b><br><span></span>';
        info.querySelector('b').textContent = fname;
        info.querySelector('span').textContent = 'Книга: «' + r.title + '», ' + Math.round(r.xml.length / 1024) + ' КБ';
        var btn = document.createElement('button');
        btn.textContent = 'Скачать';
        (function (n, x) { btn.onclick = function () { download(n, x); }; })(fname, r.xml);
        div.appendChild(info);
        div.appendChild(btn);
        results.appendChild(div);
        r.warnings.forEach(function (w) {
          var p = document.createElement('div');
          p.className = 'warn';
          p.textContent = '⚠ ' + w;
          results.appendChild(p);
        });
        ok++;
      } catch (e) {
        var er = document.createElement('div');
        er.className = 'warn';
        er.textContent = 'Ошибка в «' + job.name + '»: ' + e.message;
        results.appendChild(er);
      }
    }
    setStatus(ok ? 'Готово. Нажмите «Скачать».' : 'Не получилось.', !ok);
  }

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
    sources = []; images = new Map(); textArea.value = '';
    results.innerHTML = ''; renderLoaded(); setStatus('');
  });
})();
