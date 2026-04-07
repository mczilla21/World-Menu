(function() {
  var script = document.currentScript;
  var baseUrl = script.getAttribute('data-url') || script.src.replace('/embed.js', '');
  var btnText = script.getAttribute('data-text') || 'Order Online';
  var btnColor = script.getAttribute('data-color') || '#3b82f6';
  var mode = script.getAttribute('data-mode') || 'button'; // button, inline, full

  function createButton() {
    var btn = document.createElement('button');
    btn.textContent = btnText;
    btn.style.cssText = 'background:' + btnColor + ';color:#fff;border:none;padding:14px 28px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.15);transition:transform 0.15s,box-shadow 0.15s;';
    btn.onmouseover = function() { btn.style.transform = 'scale(1.03)'; btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; };
    btn.onmouseout = function() { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)'; };
    btn.onclick = function() {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
      var frame = document.createElement('iframe');
      frame.src = baseUrl + '/menu';
      frame.style.cssText = 'width:100%;max-width:480px;height:90vh;border:none;border-radius:16px;background:#fff;';
      var close = document.createElement('button');
      close.textContent = '×';
      close.style.cssText = 'position:absolute;top:16px;right:24px;background:rgba(0,0,0,0.5);color:#fff;border:none;width:40px;height:40px;border-radius:50%;font-size:24px;cursor:pointer;z-index:100000;';
      close.onclick = function() { overlay.remove(); };
      overlay.appendChild(frame);
      overlay.appendChild(close);
      overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
      document.body.appendChild(overlay);
    };
    return btn;
  }

  function createInline() {
    var container = document.createElement('div');
    container.style.cssText = 'width:100%;max-width:480px;margin:0 auto;';
    var frame = document.createElement('iframe');
    frame.src = baseUrl + '/menu';
    frame.style.cssText = 'width:100%;height:700px;border:none;border-radius:16px;';
    container.appendChild(frame);
    return container;
  }

  function createFull() {
    var frame = document.createElement('iframe');
    frame.src = baseUrl + '/menu';
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;z-index:99999;';
    return frame;
  }

  var target = script.parentElement;
  if (mode === 'inline') {
    target.appendChild(createInline());
  } else if (mode === 'full') {
    document.body.appendChild(createFull());
  } else {
    target.appendChild(createButton());
  }
})();
