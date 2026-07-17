import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import { initTheme } from './shared/lib/useTheme'
import App from './App'
import { ErrorBoundary } from './shared/components/ErrorBoundary'

initTheme()

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

const root = createRoot(container)

root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App/>
        </ErrorBoundary>
    </React.StrictMode>
)
