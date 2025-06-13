import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {Provider} from 'react-redux'
import ReactDom from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import './index.css'
import store from './app/store.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(

<Provider store={store}>
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
</Provider>
)
