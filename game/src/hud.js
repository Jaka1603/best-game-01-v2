// The DOM HUD: progress along the canyon, score and combo, hull, distance
// and the warning when the Night Wall closes in — plus the four screens
// (title, pause, victory, game over). main.js feeds it state and events;
// this file only writes to elements it cached once at boot.

import { MODE_OVER, MODE_PAUSED, MODE_PLAYING, MODE_TITLE, MODE_VICTORY } from './game.js';

function el(id) {
  return document.getElementById(id);
}

export function createHud() {
  const score = el('score');
  const combo = el('combo');
  const hullFill = el('hull-fill');
  const dist = el('dist');
  const wallWarn = el('wall-warn');
  const markerYou = el('marker-you');
  const markerWall = el('marker-wall');
  const floater = el('floater');
  const hurt = el('hurt');
  const screens = {
    title: el('screen-title'),
    victory: el('screen-victory'),
    over: el('screen-over'),
    pause: el('screen-pause'),
  };
  let lastMode = '';
  let lastCombo = 0;
  let floaterTimer = null;

  function fmt(n) {
    return n.toLocaleString('en-US');
  }

  function showFloater(text, colour) {
    floater.textContent = text;
    if (colour) floater.style.color = colour;
    floater.classList.remove('show');
    void floater.offsetWidth;
    floater.classList.add('show');
    if (floaterTimer) clearTimeout(floaterTimer);
    floaterTimer = setTimeout(() => floater.classList.remove('show'), 950);
  }

  function setScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle('on', key === name);
    }
  }

  return {
    showFloater,
    flashHurt() {
      hurt.style.opacity = '1';
      setTimeout(() => { hurt.style.opacity = '0'; }, 130);
    },
    setBestLine(best) {
      el('best-line').textContent = best > 0 ? `BEST SCORE ${fmt(best)}` : '';
    },
    /** Paint the HUD and the right screen for the game's current mode. */
    update(state, length) {
      score.textContent = fmt(state.score);
      const comboText = state.combo >= 2 ? `COMBO ×${state.mult} · ${state.combo}` : '';
      if (comboText !== combo.textContent) combo.textContent = comboText;
      if (state.combo > lastCombo && state.combo >= 2) {
        combo.classList.remove('pop');
        void combo.offsetWidth;
        combo.classList.add('pop');
      }
      lastCombo = state.combo;
      hullFill.style.width = `${Math.max(0, state.hull)}%`;
      hullFill.classList.toggle('low', state.hull <= 30);
      const remaining = Math.max(0, length - state.z);
      dist.textContent = `${fmt(Math.ceil(remaining))} m`;
      const gap = state.z - state.wallZ;
      wallWarn.textContent = state.mode === MODE_PLAYING && gap < 90 ? `⚠ THE WALL IS ${Math.max(0, Math.round(gap))} m BEHIND YOU` : '';
      markerYou.style.left = `${(state.z / length) * 100}%`;
      markerWall.style.left = `${Math.max(0, (state.wallZ / length) * 100)}%`;

      if (state.mode !== lastMode) {
        lastMode = state.mode;
        if (state.mode === MODE_TITLE) setScreen('title');
        else if (state.mode === MODE_PAUSED) setScreen('pause');
        else if (state.mode === MODE_VICTORY) {
          el('victory-stats').innerHTML =
            `TIME <b>${state.victoryTime.toFixed(1)}s</b> · SCORE <b>${fmt(state.score)}</b><br>` +
            `SUN-CORES <b>${state.cores}</b> · BEST COMBO <b>×${1 + Math.floor(state.bestCombo / 4)}</b>`;
          setScreen('victory');
        } else if (state.mode === MODE_OVER) {
          el('over-reason').textContent = state.overReason === 'wall'
            ? 'The Night Wall swallowed the canyon — and you with it.'
            : 'Your hull gave out among the rocks.';
          el('over-stats').innerHTML =
            `DISTANCE <b>${fmt(Math.floor(state.z))} m</b> of ${fmt(length)} m · SCORE <b>${fmt(state.score)}</b><br>` +
            `SUN-CORES <b>${state.cores}</b>`;
          setScreen('over');
        } else setScreen('');
      }
    },
  };
}
