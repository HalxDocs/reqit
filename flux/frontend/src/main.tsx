import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import { initTheme } from './shared/lib/useTheme'
import App from './App'

initTheme()

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
