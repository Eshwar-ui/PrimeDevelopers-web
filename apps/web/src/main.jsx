import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ContentProvider } from './context/ContentContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { startMeasurement } from './lib/firebase.js'
import { isProductionHost } from './lib/site.js'

// Every host but the production domain is a staging copy (CloudFront, the
// Firebase previews, localhost) and has to stay out of search results. Written
// before the first render so no page ever exists without it.
// TODO: also send `X-Robots-Tag: noindex, nofollow` from the CloudFront
// distribution — a header covers crawlers that never run this script.
if (!isProductionHost()) {
  const robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.appendChild(robots)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {/* Outermost of the three: ContentProvider holds the whole tree behind a
          loading spinner until the API answers, and the theme has to be settled
          before that spinner paints, not after. */}
      <ThemeProvider>
        <AuthProvider>
          <ContentProvider>
            <App />
          </ContentProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

// After the render call, and idle-deferred again inside — see the note in
// lib/firebase. Nothing on screen waits on this, and in development it does
// nothing at all.
startMeasurement()
