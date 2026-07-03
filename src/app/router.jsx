import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import RouteLoader from "../components/feedback/RouteLoader";
import PublicLayout from "../components/layout/PublicLayout";
import ApprovedRoute from "../features/auth/ApprovedRoute";
import AuthenticatedRoute from "../features/auth/AuthenticatedRoute";
import RoleRoute from "../features/auth/RoleRoute";
import RouteMetadata from "./RouteMetadata";

function lazyRoute(Page) {
  return <Suspense fallback={<RouteLoader />}><Page /></Suspense>;
}

export const router = createBrowserRouter([{
  element: <RouteMetadata />,
  children: [
    {
      element: <PublicLayout />,
      children: [
        { path: "/", element: lazyRoute(lazy(() => import("../pages/public/HomePage"))) },
        { path: "/about", element: lazyRoute(lazy(() => import("../pages/public/AboutPage"))) },
        { path: "/events", element: lazyRoute(lazy(() => import("../pages/public/EventsPage"))) },
        { path: "/calendar", element: lazyRoute(lazy(() => import("../pages/public/CalendarPage"))) },
        { path: "/projects", element: lazyRoute(lazy(() => import("../pages/public/ProjectsPage"))) },
        { path: "/join", element: lazyRoute(lazy(() => import("../pages/public/JoinPage"))) },
        { path: "/bod", element: lazyRoute(lazy(() => import("../pages/public/BodPage"))) },
        { path: "/faq", element: lazyRoute(lazy(() => import("../pages/public/FaqPage"))) },
        { path: "/contact", element: lazyRoute(lazy(() => import("../pages/public/ContactPage"))) },
        { path: "/terms", element: lazyRoute(lazy(() => import("../pages/public/TermsPage"))) },
        { path: "/privacy", element: lazyRoute(lazy(() => import("../pages/public/PrivacyPage"))) },
      ],
    },
    { path: "/login", element: lazyRoute(lazy(() => import("../pages/auth/LoginPage"))) },
    { path: "/signup", element: lazyRoute(lazy(() => import("../pages/auth/SignupPage"))) },
    { path: "/forgot-password", element: lazyRoute(lazy(() => import("../pages/auth/ForgotPasswordPage"))) },
    {
      element: <AuthenticatedRoute />,
      children: [{
        element: <ApprovedRoute />,
        children: [
          { path: "/access", element: lazyRoute(lazy(() => import("../pages/protected/AccessPage"))) },
          {
            element: <RoleRoute capability="memberDashboard" />,
            children: [{ path: "/dashboard", element: lazyRoute(lazy(() => import("../pages/dashboard/DashboardPage"))) }],
          },
          {
            element: <RoleRoute capability="bodTools" />,
            children: [{ path: "/bod-tools", element: lazyRoute(lazy(() => import("../pages/bod/BodToolsPage"))) }],
          },
          {
            element: <RoleRoute capability="resolutionTools" />,
            children: [{ path: "/admin/resolutions", element: lazyRoute(lazy(() => import("../pages/admin/AdminPage"))) }],
          },
          {
            element: <RoleRoute capability="presidentControls" />,
            children: [{ path: "/admin/locks", element: lazyRoute(lazy(() => import("../pages/admin/AdminPage"))) }],
          },
          {
            element: <RoleRoute capability="adminTools" />,
            children: [{ path: "/admin/*", element: lazyRoute(lazy(() => import("../pages/admin/AdminPage"))) }],
          },
        ],
      }],
    },
    { path: "*", element: lazyRoute(lazy(() => import("../pages/public/NotFoundPage"))) },
  ],
}]);
