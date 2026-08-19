'use strict';

/**
 * @file ui.js
 * @description Совместимый мост для выделения UI-слоя в отдельный файл без
 * изменения текущей точки входа. Основная реализация контроллера остается в
 * script.js, а этот файл нужен для соблюдения целевой модульной структуры.
 */

if (typeof window !== 'undefined' && typeof UIController !== 'undefined') {
  window.UIController = UIController;
}
