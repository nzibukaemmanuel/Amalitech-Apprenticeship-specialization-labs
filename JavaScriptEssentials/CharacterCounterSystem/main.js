

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
  var toggleDensityBtn = document.getElementById('toggle-density');

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

    totalCharsEl.textContent = totalChars; //displaying the total characters in html referencing totalCharsEl  
    wordCountEl.textContent = words;
    lineCountEl.textContent = lineText;
    readingTimeEl.textContent = calcReadingTime(words);//calls the function directly.

    
    if (enableLimitBox.checked) {
      var activeLimit = parseInt(limitInput.value, 10);
      var overLimit = !isNaN(activeLimit) && activeLimit > 0 && text.length >= activeLimit;
      charsCard.classList.toggle('over-limit', overLimit);
    } else {
      charsCard.classList.remove('over-limit');
    }

    var density = calcLetterDensity(text);//Calculates the frequency of each letter.
    var rows = [];
    var letterCount = text.replace(/[^a-z]/gi, '').length;
    var shouldExpand = densityList.classList.contains('expanded');// check if we have class called expanded in the densityList element. If it does, we will show all the rows, otherwise we will show only 6 rows.
    var visibleRows = shouldExpand ? density : density.slice(0, 6);

    if (toggleDensityBtn) {
      var buttonText = letterCount > 6 ? 'Show more' : 'Show less';
      toggleDensityBtn.textContent = buttonText;
      toggleDensityBtn.disabled = letterCount <= 6;
      if (letterCount <= 6) {
        densityList.classList.remove('expanded');
        toggleDensityBtn.setAttribute('aria-expanded', 'false');// 
      }
    }

    for (var k = 0; k < visibleRows.length; k++) {
      var item = visibleRows[k];
      rows.push( //adds a new HTML string to the end of the rows array.
        '<div class="density-row">' +
          '<span class="letter">' + item.letter + '</span>' +
          '<div class="progress-container">' +
            '<div class="progress-bar" style="width: ' + item.barPercent.toFixed(2) + '%"></div>' +
          '</div>' +
          '<span class="stats">' + item.count + ' (' + item.percent.toFixed(2) + '%)</span>' +
        '</div>'
      );
    }

    densityList.innerHTML = rows.join('');//which displays the letter density chart.
  }



  textInput.addEventListener('input', render);//Whenever the user types, deletes, or pastes text into textInput, call the render() function.
  excludeSpacesBox.addEventListener('change', render);

  document.querySelectorAll('.checkbox-label').forEach(function (label) { //It finds every HTML element with the class (checkbox-lebel)
    label.addEventListener('keydown', function (event) {                     //It listens for keydown events on each label. When a key is pressed while the label is focused, it checks if the pressed key is either 'Enter' or 'Space'.
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();                                        //stops that default behavior so your custom code can handle the key press.
        var checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));// travel up the DOM tree and trigger any event listeners attached to the checkbox's change event.
        }
      }
    });
  });

  if (toggleDensityBtn) {
    toggleDensityBtn.addEventListener('click', function () {
      var expanded = densityList.classList.toggle('expanded');//adds or removes a CSS class
      toggleDensityBtn.textContent = expanded ? 'Show less' : 'Show more';
      toggleDensityBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      render();
    });
  }

  enableLimitBox.addEventListener('change', function () {
    var isChecked = enableLimitBox.checked;
    limitInput.style.display = isChecked ? 'inline-block' : 'none';
    enableLimitBox.setAttribute('aria-expanded', isChecked ? 'true' : 'false');
    if (isChecked) {
      limitInput.focus();
    }
    render(); //UPDATING ALL COUNTS WHEN ENABLE LIMIT CHECKBOX IS CHECKED OR UNCHECKED
  });

  limitInput.addEventListener('input', render);

 
  themeToggle.addEventListener('click', function () {
    document.body.classList.toggle('light-theme');
    var isLightTheme = document.body.classList.contains('light-theme');
    themeToggle.setAttribute('aria-pressed', isLightTheme ? 'true' : 'false');
    themeToggle.setAttribute('aria-label', isLightTheme ? 'Switch to dark theme' : 'Switch to light theme');
  });

  themeToggle.setAttribute('aria-pressed', 'false');//button is not pressed by default. adds or updates the aria-pressed attribute of the theme button.
  themeToggle.setAttribute('aria-label', 'Switch to light theme');//button a description for screen readers.

  render(); // to To initialize the page with correct values and update all statistics on page load 
});
