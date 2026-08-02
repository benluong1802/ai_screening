import { BrowserRouter, Routes, Route } from "react-router-dom";
import ApplyForm from "./ApplyForm";
import Dashboard from "./Dashboard";
import Login from "./Login";

function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<ApplyForm />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

      </Routes>

    </BrowserRouter>

  );

}

export default App;