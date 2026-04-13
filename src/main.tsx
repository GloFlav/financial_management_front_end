import { createRoot } from 'react-dom/client'
import type { ComponentType, Root } from 'react-dom/client'
import './index.css'
import App from './App'
import IslandApp from './IslandApp'
import ChatApp from './ChatApp'
import SchedulerExpanded from './SchedulerExpanded'

const hash = window.location.hash

let Component: ComponentType
if (hash === '#island') {
  Component = IslandApp
} else if (hash === '#chat') {
  Component = ChatApp
} else if (hash === '#scheduler-expanded') {
  Component = SchedulerExpanded
} else {
  Component = App
}

// Singleton root — prevent Vite HMR from creating multiple React roots
// on the same #root element (which causes visual duplication of components)
const rootEl = document.getElementById('root')!
declare global { interface Window { __reactRoot?: Root } }

if (!window.__reactRoot) {
  window.__reactRoot = createRoot(rootEl)
}
window.__reactRoot.render(<Component />)
