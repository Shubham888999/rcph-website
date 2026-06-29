import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import RouteLoader from "../components/feedback/RouteLoader";
import PublicLayout from "../components/layout/PublicLayout";
import ProtectedRoute from "../features/auth/ProtectedRoute";

function lazyRoute(Page) {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Page />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        path: "/",
        element: lazyRoute(lazy(() => import("../pages/public/HomePage"))),
      },
      {
        path: "/login",
        element: lazyRoute(lazy(() => import("../pages/auth/LoginPage"))),
      },
      { path: "/about", element: lazyRoute(lazy(() => import("../pages/public/AboutPage"))) },
      { path: "/events", element: lazyRoute(lazy(() => import("../pages/public/EventsPage"))) },
      { path: "/calendar", element: lazyRoute(lazy(() => import("../pages/public/CalendarPage"))) },
      { path: "/projects", element: lazyRoute(lazy(() => import("../pages/public/ProjectsPage"))) },
      { path: "/join", element: lazyRoute(lazy(() => import("../pages/public/JoinPage"))) },
      { path: "/bod", element: lazyRoute(lazy(() => import("../pages/public/BodPage"))) },
      { path: "/faq", element: lazyRoute(lazy(() => import("../pages/public/FaqPage"))) },
      { path: "/contact", element: lazyRoute(lazy(() => import("../pages/public/ContactPage"))) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/dashboard",
        element: lazyRoute(lazy(() => import("../pages/dashboard/DashboardPage"))),
      },
      {
        path: "/admin",
        element: lazyRoute(lazy(() => import("../pages/admin/AdminPage"))),
      },
    ],
  },
  {
    path: "*",
    element: lazyRoute(lazy(() => import("../pages/public/NotFoundPage"))),
  },
]);
