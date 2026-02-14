// Load shared body layout into the document.
// This script must be included BEFORE the renderer script in the HTML file.
// Module scripts execute in document order, so the DOM elements will be
// available by the time the renderer script runs.
import { sharedBodyHTML } from './html_shared_body.js';
document.body.insertAdjacentHTML('afterbegin', sharedBodyHTML);
