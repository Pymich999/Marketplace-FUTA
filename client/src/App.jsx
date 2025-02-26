import { useState } from 'react'
import React from "react";
import { Routes, Route } from "react-router-dom";
import Signup from './components/Signup'

function App() {
  return(
    <Routes>
      <Route path="/" element={<Signup />} />
    </Routes>
  )
}

export default App
