import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from './Header';

import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Job from "./pages/Job";
import "./style.css"

function App() {
  return (
    <div className="app bg-light min-vh-100">
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/job/:id" element={<Job />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
