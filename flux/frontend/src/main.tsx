import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import { initTheme } from './shared/lib/useTheme'
import App from './App'

initTheme()

// Allow normal scrolling — override the desktop-app overflow:hidden
document.body.style.overflow = "auto";
document.documentElement.style.overflow = "auto";

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

const root = createRoot(container)

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
