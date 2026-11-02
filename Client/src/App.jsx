import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Sessions from "@/pages/Sessions";
import Tracker from "@/pages/Tracker";
import SessionHistory from "@/pages/SessionHistory";
import AssetAnalytics from "@/pages/AssetAnalytics";
import TradeJournal from "@/pages/TradeJournal";
import RiskGuard from "@/pages/RiskGuard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      {
        path: "/",
        element: <Dashboard />,
      },
      {
        path: "/sessions",
        element: <Sessions />,
      },
      {
        path: "/tracker",
        element: <Tracker />,
      },
      {
        path: "/history",
        element: <SessionHistory />,
      },
      {
        path: "/assets",
        element: <AssetAnalytics />,
      },
      {
        path: "/journal",
        element: <TradeJournal />,
      },
      {
        path: "/risk",
        element: <RiskGuard />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
