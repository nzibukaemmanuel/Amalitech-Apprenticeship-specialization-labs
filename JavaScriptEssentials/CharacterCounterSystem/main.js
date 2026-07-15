

document.addEventListener('DOMContentLoaded', function () {


  var textInput        = document.getElementById('text-input');
  var excludeSpacesBox = document.getElementById('exclude-spaces');
  var enableLimitBox   = document.getElementById('enable-char-limit');
  var limitInput       = document.getElementById('char-limit-input');

  var totalCharsEl     = document.getElementById('total-characters');
  var wordCountEl      = document.getElementById('word-count');
  var lineCountEl      = document.getElementById('line-count');
  var readingTimeEl    = document.getElementById('reading-time');
  var charsCard        = document.getElementById('chars-card');
  var densityList      = document.getElementById('density-list');

  var themeToggle      = document.getElementById('theme-toggle');

  var AVG_READING_WPM  = 200; 
  var alphabet        = 'abcdefghijklmnopqrstuvwxyz'.split('');



  function countCharacters(text) {
    if (excludeSpacesBox.checked) {
      return text.replace(/\s/g, '').length;
    }
    return text.length;
  }

  function countWords(text) {
    var trimmed = text.trim();
    if (trimmed === '') {
      return 0;
    }
    return trimmed.split(/\s+/).length;
  }

  function countLines(text) {
    if (text === '') {
      return 0;
    }
    return text.split(/\n/).length;
  }

  function calcReadingTime(wordCount) {
    var minutes = wordCount / AVG_READING_WPM;
    if (minutes < 1) {
      return '<1 minute';
    }
    var rounded = Math.round(minutes);
    return rounded + ' minute' + (rounded === 1 ? '' : 's');
  }


  function calcLetterDensity(text) {
    var counts = {};
    var totalLetters = 0;
    var loweredText = text.toLowerCase();

    for (var i = 0; i < loweredText.length; i++) {
      var rawChar = loweredText.charAt(i);
      if (/[a-z]/.test(rawChar)) {
        counts[rawChar] = (counts[rawChar] || 0) + 1;
        totalLetters++;
      }
    }

    var countValues = [];
    var keys = Object.keys(counts);
    for (var j = 0; j < keys.length; j++) {
      countValues.push(counts[keys[j]]);
    }

    var maxCount = countValues.reduce(function (highest, count) {
      return Math.max(highest, count);
    }, 0);

    return alphabet.map(function (letter) {
      var count = counts[letter] || 0;
      return {
        letter: letter,
        count: count,
        percent: totalLetters ? (count / totalLetters) * 100 : 0,
        
        barPercent: maxCount ? (count / maxCount) * 100 : 0
      };
    });
  }

  

  function render() {
    var text = textInput.value;

    
    if (enableLimitBox.checked) {
      var limit = parseInt(limitInput.value, 10);
      if (!isNaN(limit) && limit > 0 && text.length > limit) {
        text = text.slice(0, limit);
        textInput.value = text;
      }
    }

    var totalChars = countCharacters(text);
    var words = countWords(text);
    var lines = countLines(text);
    var lineText = String(lines);

    if (lineText.length < 2) {
      lineText = '0' + lineText;
    }

    totalCharsEl.textContent = totalChars;
    wordCountEl.textContent = words;
    lineCountEl.textContent = lineText;
    readingTimeEl.textContent = calcReadingTime(words);

    
    if (enableLimitBox.checked) {
      var activeLimit = parseInt(limitInput.value, 10);
      var overLimit = !isNaN(activeLimit) && activeLimit > 0 && text.length >= activeLimit;
      charsCard.classList.toggle('over-limit', overLimit);
    } else {
      charsCard.classList.remove('over-limit');
    }

    var density = calcLetterDensity(text);
    var rows = [];

    for (var k = 0; k < density.length; k++) {
      var item = density[k];
      rows.push(
        '<div class="density-row">' +
          '<span class="letter">' + item.letter + '</span>' +
          '<div class="progress-container">' +
            '<div class="progress-bar" style="width: ' + item.barPercent.toFixed(2) + '%"></div>' +
          '</div>' +
          '<span class="stats">' + item.count + ' (' + item.percent.toFixed(2) + '%)</span>' +
        '</div>'
      );
    }

    densityList.innerHTML = rows.join('');
  }



  textInput.addEventListener('input', render);
  excludeSpacesBox.addEventListener('change', render);

  enableLimitBox.addEventListener('change', function () {
    limitInput.style.display = enableLimitBox.checked ? 'inline-block' : 'none';
    if (enableLimitBox.checked) {
      limitInput.focus();
    }
    render();
  });

  limitInput.addEventListener('input', render);

 
  themeToggle.addEventListener('click', function () {
    document.body.classList.toggle('light-theme');
    var isLightTheme = document.body.classList.contains('light-theme');
    themeToggle.setAttribute('aria-pressed', isLightTheme ? 'true' : 'false');
  });

  themeToggle.setAttribute('aria-pressed', 'false');

  render();
});