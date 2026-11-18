// main.js — boot. Reads the scene request from the page address (the kit's screenshot
// scenes use ?shot=start|play|boss|end&seed=1), builds the game on the page's canvas
// and starts its loop. A plain visit gets a clock seed, so every sky is different.

import { Game } from './game.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Date.now() % 100000;

const game = new Game(canvas, { shot: params.get('shot'), seed });
game.start();
