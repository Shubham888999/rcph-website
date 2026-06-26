import { createBrowserRouter } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import HomePage from "../pages/public/HomePage";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import AdminPage from "../pages/admin/AdminPage";
import NotFoundPage from "../pages/public/NotFoundPage";
import AboutPage from "../pages/public/AboutPage";
import EventsPage from "../pages/public/EventsPage";
import ProjectsPage from "../pages/public/ProjectsPage";
import JoinPage from "../pages/public/JoinPage";
import BodPage from "../pages/public/BodPage";
import FaqPage from "../pages/public/FaqPage";
import ContactPage from "../pages/public/ContactPage";

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      { path: "/about", element: <AboutPage /> },
      { path: "/events", element: <EventsPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/join", element: <JoinPage /> },
      { path: "/bod", element: <BodPage /> },
      { path: "/faq", element: <FaqPage /> },
      { path: "/contact", element: <ContactPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
      {
        path: "/admin",
        element: <AdminPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
